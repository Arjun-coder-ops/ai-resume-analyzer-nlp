// lib/utils.js - Lightweight class name utility conforming to React 18

export function cn(...inputs) {
  return inputs
    .flat()
    .filter(Boolean)
    .join(' ')
    .trim()
}
