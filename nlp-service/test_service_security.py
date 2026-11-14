import os
from io import BytesIO
import unittest

import fitz

# Keep route tests deterministic and independent of model downloads.
os.environ.setdefault("NLP_LOAD_EMBEDDINGS", "false")

import app


class InternalServiceAuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.client = app.app.test_client()
        self.original_required = os.environ.get("REQUIRE_INTERNAL_AUTH")
        self.original_token = os.environ.get("INTERNAL_NLP_TOKEN")
        os.environ["REQUIRE_INTERNAL_AUTH"] = "true"

    def tearDown(self):
        if self.original_required is None:
            os.environ.pop("REQUIRE_INTERNAL_AUTH", None)
        else:
            os.environ["REQUIRE_INTERNAL_AUTH"] = self.original_required
        if self.original_token is None:
            os.environ.pop("INTERNAL_NLP_TOKEN", None)
        else:
            os.environ["INTERNAL_NLP_TOKEN"] = self.original_token

    def test_missing_server_secret_fails_closed(self):
        os.environ.pop("INTERNAL_NLP_TOKEN", None)
        response = self.client.post("/analyze")
        self.assertEqual(response.status_code, 503)

    def test_missing_client_secret_is_rejected(self):
        os.environ["INTERNAL_NLP_TOKEN"] = "test-internal-secret"
        response = self.client.post("/analyze")
        self.assertEqual(response.status_code, 401)

    def test_valid_client_secret_reaches_request_validation(self):
        os.environ["INTERNAL_NLP_TOKEN"] = "test-internal-secret"
        response = self.client.post(
            "/analyze",
            headers={"X-Internal-Token": "test-internal-secret"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["error"], "No resume file provided")

    def test_invalid_pdf_bytes_are_rejected_before_parser_invocation(self):
        with self.assertRaises(app.ResumeValidationError):
            app.extract_text_from_pdf(b"not-a-pdf")

    def test_password_protected_pdf_is_rejected_by_the_analysis_route(self):
        document = fitz.open()
        page = document.new_page()
        page.insert_text((72, 72), "Confidential resume content")
        encrypted_pdf = document.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw="owner-secret",
            user_pw="reader-secret",
        )
        document.close()

        os.environ["INTERNAL_NLP_TOKEN"] = "test-internal-secret"
        response = self.client.post(
            "/analyze",
            data={
                "resume": (BytesIO(encrypted_pdf), "protected.pdf"),
                "job_description": "A sufficiently detailed job description for PDF validation coverage.",
            },
            headers={"X-Internal-Token": "test-internal-secret"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["error"], "Password-protected PDFs are not supported.")
