type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-white rounded-card border border-line shadow-[0_1px_8px_rgba(0,0,0,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}
