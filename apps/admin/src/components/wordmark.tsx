/** The house name set as a mark. The apostrophe is pulled in so the letters keep an even rhythm. */
export function Wordmark({ className }: { className: string }) {
  return (
    <span className={`wordmark ${className}`}>
      N<span className="wordmark__apo">’</span>AIT
    </span>
  )
}
