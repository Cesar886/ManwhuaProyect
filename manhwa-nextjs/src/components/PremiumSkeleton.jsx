import styles from './PremiumSkeleton.module.css';

export default function PremiumSkeleton() {
    return (
        <div className={styles.premiumSkeleton}>
            <div className={styles.skeletonShimmer} />
        </div>
    );
}

export function PremiumSkeletonGrid({ count = 12 }) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <PremiumSkeleton key={i} />
            ))}
        </>
    );
}
