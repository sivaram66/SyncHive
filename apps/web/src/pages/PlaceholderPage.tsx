import styles from './PlaceholderPage.module.css'

interface Props {
  title: string
  subtitle: string
}

export function PlaceholderPage({ title, subtitle }: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.icon}>
        <HexIcon />
      </div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.sub}>{subtitle}</p>
    </div>
  )
}

function HexIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2L25 8v12L14 26 3 20V8L14 2z" />
      <path d="M14 8v12M8 11l6 3 6-3" />
    </svg>
  )
}
