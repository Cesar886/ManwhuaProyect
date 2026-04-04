import { permanentRedirect } from 'next/navigation'

export default function EnRootPage() {
  permanentRedirect('/en/home')
}
