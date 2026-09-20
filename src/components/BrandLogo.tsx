import { SITE_NAME } from '../lib/site';

type Props = {
  size?: number;
  className?: string;
};

export function BrandLogo({ size = 42, className = 'brand-logo' }: Props) {
  return (
    <img
      src="/logo.svg"
      alt={SITE_NAME}
      width={size}
      height={size}
      className={className}
      decoding="async"
    />
  );
}
