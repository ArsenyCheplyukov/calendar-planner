import { forwardRef, type HTMLAttributes } from "react";
import styles from "./Card.module.css";

export type CardPadding = "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  elevated?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding = "md", elevated = false, className, children, ...rest },
  ref,
) {
  const classes = [styles["card"], className].filter(Boolean).join(" ");

  return (
    <div
      ref={ref}
      className={classes}
      data-padding={padding}
      data-elevated={elevated ? "true" : undefined}
      {...rest}
    >
      {children}
    </div>
  );
});
