import './globals.css'

export const metadata = {
  title: 'Health Tracker',
  description: 'Your personal health and fitness dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
