import { Button, Container, Group, Text, Title } from '@mantine/core';
import { Image404 } from './404Image';
import classes from './404.module.css';
import { useRouter } from 'next/navigation';

export default function NotFound() {
    const router = useRouter();
  return (
    <Container className={classes.root}>
      <div className={classes.inner}>
        <Image404 className={classes.image} />
        <div className={classes.content}>
          <Title className={classes.title}>Pagina no encontrada</Title>
          <Text c="dimmed" size="lg" ta="center" className={classes.description}>
            La página que intentas abrir no existe. Puede que hayas escrito mal la dirección, o que la
            página haya sido movida a otra URL. Si crees que esto es un error, contacta con soporte.
          </Text>
          <Group justify="center">
            <Button size="md" onClick={() => router.push('/home')}>Inicio</Button>
          </Group>
        </div>
      </div>
    </Container>
  );
}