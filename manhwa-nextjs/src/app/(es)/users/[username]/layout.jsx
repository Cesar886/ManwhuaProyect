export async function generateMetadata({ params }) {
  const { username } = await params;
  return {
    title: `Perfil de @${decodeURIComponent(username)} | Manhwa Imperial`,
    description: `Perfil público de @${decodeURIComponent(username)} en Manhwa Imperial.`,
  };
}

export default function PublicUserProfileLayout({ children }) {
  return children;
}
