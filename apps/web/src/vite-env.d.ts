/// <reference types="vite/client" />

// CSS Module declarations — tells TypeScript that .module.css imports are valid
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.module.scss' {
  const classes: Record<string, string>
  export default classes
}
