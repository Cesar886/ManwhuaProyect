'use client';

import { Box, Container, Stack, Text, Group, Button, Center, SimpleGrid } from '@mantine/core';
import {
    IconX,
    IconCheck,
    IconSparkles,
    IconInfinity,
    IconDownload,
    IconBolt,
    IconAdFilled,
    IconHeartFilled,
    IconMoodSmileBeam,
    IconPin,
    IconCrown,
    IconShieldStar,
    IconListDetails,
    IconChartBar,
    IconFlask,
    IconStar,
} from '@tabler/icons-react';
import Link from 'next/link';
import Header from '@/components/Header';
import styles from './Vip.module.css';

const FEATURES = [
    {
        icon: IconInfinity,
        title: 'Scroll infinito',
        desc: 'Lee capítulo tras capítulo sin cortes, paginación ni pausas. Solo tú y la historia.',
    },
    {
        icon: IconDownload,
        title: 'Descarga offline',
        desc: 'Guarda tus manhwas favoritos y léelos sin conexión, donde y cuando quieras.',
    },
    {
        icon: IconBolt,
        title: 'IA sin límites',
        desc: 'Recomendaciones y búsquedas inteligentes ilimitadas, 24/7. Sin cuota diaria.',
    },
    {
        icon: IconAdFilled,
        title: 'Cero anuncios',
        desc: 'Una experiencia de lectura limpia, rápida y sin interrupciones comerciales.',
    },
    {
        icon: IconListDetails,
        title: 'Listas ilimitadas',
        desc: 'Crea todas las listas personalizadas que quieras. Los usuarios gratis solo tienen Favoritos.',
    },
    {
        icon: IconMoodSmileBeam,
        title: 'Reacciones exclusivas',
        desc: 'Emojis premium que solo los VIP pueden usar en comentarios y reseñas.',
    },
    {
        icon: IconPin,
        title: 'Fija tus comentarios',
        desc: 'Destaca tu opinión arriba de la conversación y haz que la comunidad la vea primero.',
    },
    {
        icon: IconShieldStar,
        title: 'Badge & perfil VIP',
        desc: 'Insignia visible, nombre en dorado y perfil destacado en toda la comunidad.',
    },
    {
        icon: IconFlask,
        title: 'Funciones beta',
        desc: 'Prueba las nuevas funciones antes que nadie y ayuda a decidir el rumbo del imperio.',
    },
    {
        icon: IconHeartFilled,
        title: 'Apoyas nuestros servicios',
        desc: 'Al hacerte VIP ayudas a que mantengamos y mejoremos la plataforma para que el servicio siga activo.',
    },
];

const STATUS_PERKS = [
    { icon: IconCrown,     title: 'Nombre destacado',       desc: 'Visible en dorado en toda la comunidad.' },
    { icon: IconStar,      title: 'Comentarios destacados', desc: 'Tus opiniones suben arriba automáticamente.' },
    { icon: IconChartBar,  title: 'Perfil con estadísticas',desc: 'Racha de lectura, capítulos y géneros.' },
    { icon: IconFlask,     title: 'Acceso anticipado',      desc: 'Funciones beta antes del lanzamiento público.' },
];

const COMPARISON = [
    { feature: 'Leer manhwas',               free: true,  vip: true  },
    { feature: 'Buscador IA (Básico)',       freeLabel: '10 búsquedas / día', vipLabel: '×' },
    { feature: 'IA Imperial Pro',            freeLabel: '×', vipLabel: 'Ilimitado + Mayor Precisión' },
    { feature: 'XP por capítulo',            freeLabel: '×1',       vipLabel: '×3' },
    { feature: 'Scroll infinito',            free: false, vip: true  },
    { feature: 'Descarga offline',           free: false, vip: true  },
    { feature: 'Sin anuncios',               free: false, vip: true  },
    { feature: 'Badge & perfil VIP',         free: false, vip: true  },
    { feature: 'Reacciones exclusivas',      free: false, vip: true  },
    { feature: 'Fijar comentarios',          free: false, vip: true  },
    { feature: 'Perfil con estadísticas',    free: false, vip: true  },
    { feature: 'Funciones beta',             free: false, vip: true  },
];

function FreeCell({ free, freeLabel }) {
    if (freeLabel) {
        return (
            <Center className={styles.compareCell}>
                <span className={styles.labelFree}>{freeLabel}</span>
            </Center>
        );
    }
    return (
        <Center className={styles.compareCell}>
            {free
                ? <span className={styles.checkIcon}><IconCheck size={16} stroke={2.5} /></span>
                : <span className={styles.crossIcon}><IconX size={16} stroke={2.5} /></span>
            }
        </Center>
    );
}

function VipCell({ vip, vipLabel }) {
    if (vipLabel) {
        return (
            <Center className={`${styles.compareCell} ${styles.compareCellVip}`}>
                <span className={styles.labelVip}>{vipLabel}</span>
            </Center>
        );
    }
    return (
        <Center className={`${styles.compareCell} ${styles.compareCellVip}`}>
            {vip
                ? <span className={styles.checkIconVip}><IconCheck size={16} stroke={3} /></span>
                : <span className={styles.crossIcon}><IconX size={16} stroke={2.5} /></span>
            }
        </Center>
    );
}

function CompareRow({ feature, free, vip, freeLabel, vipLabel, isLast }) {
    return (
        <div className={`${styles.compareRow} ${isLast ? styles.compareRowLast : ''}`}>
            <Text size="sm" className={styles.compareFeature}>{feature}</Text>
            <FreeCell free={free} freeLabel={freeLabel} />
            <VipCell vip={vip} vipLabel={vipLabel} />
        </div>
    );
}

function FeatureCard({ icon: Icon, title, desc, index }) {
    return (
        <div className={styles.featureCard}>
            <span className={styles.featureNumber}>{String(index + 1).padStart(2, '0')}</span>
            <div className={styles.featureCardInner}>
                <div className={styles.featureIconWrap}>
                    <Icon size={22} stroke={1.8} className={styles.featureIcon} />
                </div>
                <Text fw={700} size="md" className={styles.featureTitle} mt={16} mb={6}>
                    {title}
                </Text>
                <Text size="sm" className={styles.featureDesc}>
                    {desc}
                </Text>
            </div>
        </div>
    );
}

export default function VipClient() {
    return (
        <Box bg="var(--page-bg)" c="var(--text-color)" mih="100vh">
            <Container size="md" py="sm" className="siteContainer">
                <Header />

                <Stack gap={{ base: 44, sm: 56, md: 64 }} pb={{ base: 48, md: 80 }} className={styles.pageOffset}>

                    {/* ══ HERO ══ */}
                    <section className={styles.hero}>
                        <div className={styles.heroTopLine} aria-hidden="true" />
                        <div className={styles.heroGlow} aria-hidden="true" />
                        <div className={styles.heroGlow2} aria-hidden="true" />

                        <Stack align="center" gap="lg" className={styles.heroContent}>
                            <div className={styles.crownWrap}>
                                        <IconCrown size={58} stroke={2.3} color="#facc15" className={styles.crownShine} />
                            </div>

                            <Stack align="center" gap={14}>
                                <div className={styles.heroBadge}>
                                    <span className={styles.heroBadgeDot} aria-hidden="true" />
                                    <IconSparkles size={12} />
                                    <span>Membresía exclusiva</span>
                                </div>

                                <h1 className={styles.heroTitle}>
                                    <span className={styles.heroTitleVip}>VIP</span>
                                    {' '}
                                    <span className={styles.heroTitleRest}>Imperial</span>
                                </h1>

                                <Text className={styles.heroSubtitle} ta="center" maw={520}>
                                    Lectura sin interrupciones, IA sin límites, badges exclusivos
                                    y todas las ventajas que convierten a un lector en realeza.
                                </Text>
                            </Stack>

                            <Button
                                size="lg"
                                radius="xl"
                                className={styles.ctaButton}
                                leftSection={<IconCrown size={22} stroke={2.3} color="#facc15" className={styles.crownShine} />}
                                disabled
                            >
                                Próximamente
                            </Button>

                            <Text className={styles.heroDisclaimer}>
                                Sin anuncios · Sin compromisos · Cancela cuando quieras
                            </Text>

                            {/* ── Quick stats bar ── */}
                            <div className={styles.statsRow}>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>∞</div>
                                    <div className={styles.statLabel}>IA sin límites</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>0</div>
                                    <div className={styles.statLabel}>Anuncios</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>×2</div>
                                    <div className={styles.statLabel}>XP por capítulo</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>10+</div>
                                    <div className={styles.statLabel}>Ventajas premium</div>
                                </div>
                            </div>
                        </Stack>
                    </section>

                    {/* ══ COMPARATIVA ══ */}
                    <section>
                        <Stack gap={10} mb={32} align="center">
                            <Text tt="uppercase" size="sm" fw={800} className={styles.sectionEyebrow} style={{ letterSpacing: '0.15em' }}>Comparativa</Text>
                            <Text fw={900} size="h1" className={styles.sectionTitle} ta="center">El antes y el después</Text>
                            <Text size="md" c="dimmed" ta="center" maw={500}>La diferencia entre leer y vivir los manhwas.</Text>
                        </Stack>

                        <div className={styles.compareWrapper}>
                            <div className={styles.compareHeader}>
                                <div className={styles.compareFeature} />

                                <Center className={styles.compareCell}>
                                    <Stack gap={2} align="center">
                                        <Text size="xs" fw={800} className={styles.headerFreeText} tt="uppercase" style={{ letterSpacing: '0.1em' }}>Gratis</Text>
                                        <Text size="xs" className={styles.headerFreeSub} fw={500}>Todos</Text>
                                    </Stack>
                                </Center>

                                <Center className={`${styles.compareCell} ${styles.compareHeaderVip}`}>
                                    <Stack gap={4} align="center">
                                        <Group gap={5}>
                                            <IconCrown size={20} stroke={2.3} color="#facc15" className={styles.crownShine} />
                                            <Text size="xs" fw={800} className={styles.headerVipText} tt="uppercase" style={{ letterSpacing: '0.1em' }}>VIP</Text>
                                        </Group>
                                        <Text size="xs" fw={600} className={styles.headerVipSub}>Todo desbloqueado</Text>
                                    </Stack>
                                </Center>
                            </div>

                            <div className={styles.compareBody}>
                                {COMPARISON.map((row, i) => (
                                    <CompareRow
                                        key={row.feature}
                                        {...row}
                                        isLast={i === COMPARISON.length - 1}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ══ STATUS / BADGE SHOWCASE ══ */}
                    <section className={styles.statusSection}>
                        <div className={styles.statusBorder} aria-hidden="true" />
                        <div className={styles.statusGlow} aria-hidden="true" />

                        <div className={styles.statusGrid}>
                            <Stack gap="md" className={styles.statusLeft}>
                                <Text tt="uppercase" size="sm" fw={800} className={styles.sectionEyebrow} style={{ letterSpacing: '0.15em' }}>
                                    🏆 Estatus
                                </Text>
                                <Text fw={900} className={styles.statusTitle}>
                                    Destaca en toda la comunidad
                                </Text>
                                <Text size="sm" className={styles.statusDesc}>
                                    Un badge dorado, un nombre que brilla y un perfil que impone respeto.
                                    Lectores VIP son imposibles de ignorar.
                                </Text>

                                <SimpleGrid cols={{ base: 2, md: 1 }} spacing={{ base: 'sm', md: 'md' }} mt={6}>
                                    {STATUS_PERKS.map(({ icon: Icon, title, desc }) => (
                                        <Group key={title} gap={12} wrap="nowrap" align="flex-start">
                                            <div className={styles.statusPerkIcon}>
                                                <Icon size={16} stroke={2} />
                                            </div>
                                            <div>
                                                <Text fw={700} size="sm" className={styles.statusPerkTitle}>{title}</Text>
                                                <Text size="xs" className={styles.statusPerkDesc}>{desc}</Text>
                                            </div>
                                        </Group>
                                    ))}
                                </SimpleGrid>
                            </Stack>

                            {/* ── Comment mockup ── */}
                            <div className={styles.commentMockup}>
                                <Text tt="uppercase" size="xs" fw={700} className={styles.mockupLabel}>
                                    Así se ven tus comentarios
                                </Text>

                                {/* VIP comment */}
                                <div className={`${styles.mockupComment} ${styles.mockupVip}`}>
                                    <div className={styles.mockupAvatar}>
                                        <IconCrown size={22} stroke={2.3} color="#facc15" className={styles.crownShine} />
                                    </div>
                                    <div className={styles.mockupBody}>
                                        <Group gap={8} wrap="nowrap" mb={4}>
                                            <Text className={styles.mockupNameVip} fw={800} size="sm">Anónimo</Text>
                                            <span className={styles.mockupBadgeVip}>
                                                <IconCrown size={10} stroke={2.5} className={styles.crownShine} />
                                                VIP
                                            </span>
                                            <span className={styles.mockupPin}>
                                                <IconPin size={10} stroke={2.5} />
                                                Fijado
                                            </span>
                                        </Group>
                                        <Text size="sm" className={styles.mockupText}>
                                            Capítulo brutal. Necesitamos una S2 YA 🔥🔥
                                        </Text>
                                        <Group gap={6} mt={8}>
                                            <span className={styles.mockupReactionVip}>🔥 24</span>
                                            <span className={styles.mockupReactionVip}>👑 12</span>
                                            <span className={styles.mockupReactionVip}>💎 8</span>
                                        </Group>
                                    </div>
                                </div>

                                {/* Free comment */}
                                <div className={styles.mockupComment}>
                                    <div className={`${styles.mockupAvatar} ${styles.mockupAvatarFree}`}>
                                        <Text size="sm" fw={700}>A</Text>
                                    </div>
                                    <div className={styles.mockupBody}>
                                        <Group gap={8} mb={4}>
                                            <Text className={styles.mockupNameFree} fw={600} size="sm">Anónimo</Text>
                                        </Group>
                                        <Text size="sm" className={styles.mockupText}>
                                            Buen capítulo la verdad
                                        </Text>
                                        <Group gap={6} mt={8}>
                                            <span className={styles.mockupReactionFree}>👍 3</span>
                                        </Group>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ══ FEATURES GRID ══ */}
                    <section>
                        <Stack gap={10} mb={32} align="center">
                            <Text tt="uppercase" size="sm" fw={800} className={styles.sectionEyebrow} style={{ letterSpacing: '0.15em' }}>Ventajas VIP</Text>
                            <Text fw={900} size="h1" className={styles.sectionTitle} ta="center">
                                Todo lo que desbloqueas
                            </Text>
                            <Text size="md" c="dimmed" ta="center" maw={520}>
                                Funciones diseñadas para que leas más, mejor y sin fricción.
                            </Text>
                        </Stack>

                        <SimpleGrid cols={{ base: 2, sm: 2, md: 3 }} spacing={{ base: 'sm', sm: 'md' }}>
                            {FEATURES.map((f, i) => (
                                <FeatureCard key={f.title} {...f} index={i} />
                            ))}
                        </SimpleGrid>
                    </section>

                    {/* ══ CTA FINAL ══ */}
                    <section className={styles.ctaFinal}>
                        <div className={styles.ctaFinalBorder} aria-hidden="true" />
                        <div className={styles.ctaFinalGlow} aria-hidden="true" />

                        <Stack align="center" gap="md" className={styles.ctaFinalContent}>
                            <div className={styles.ctaFinalCrown}>
                                <IconCrown size={46} stroke={2.3} color="#facc15" className={styles.crownShine} />
                            </div>
                            <Stack align="center" gap={8}>
                                <Text fw={800} className={styles.ctaFinalTitle} ta="center">
                                    Tu trono te espera
                                </Text>
                                <Text size="sm" className={styles.ctaFinalDesc} ta="center" maw={420}>
                                    Sé el primero en enterarte cuando el acceso VIP esté disponible.
                                    Lectura premium, sin interrupciones.
                                </Text>
                            </Stack>
                            <Group gap="md" wrap="wrap" justify="center" mt={6} className={styles.ctaFinalActions}>
                                <Button
                                    size="md"
                                    radius="xl"
                                    className={styles.ctaButton}
                                    leftSection={<IconCrown size={22} stroke={2.3} color="#facc15" className={styles.crownShine} />}
                                    styles={{ inner: { gap: '16px' } }}
                                    style={{ paddingInline: '36px', paddingBlock: '12px' }}
                                    disabled
                                >
                                    Próximamente
                                </Button>
                                <Button
                                    size="md"
                                    radius="xl"
                                    variant="subtle"
                                    color="gray"
                                    component={Link}
                                    href="/biblioteca"
                                >
                                    Seguir leyendo gratis
                                </Button>
                            </Group>
                        </Stack>
                    </section>

                </Stack>
            </Container>
        </Box>
    );
}
