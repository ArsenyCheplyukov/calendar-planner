import { type ElementType, type HTMLAttributes, type ReactNode } from "react";
import styles from "./Surface.module.css";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
}

export function Surface({
  as: Component = "div",
  className,
  children,
  ...rest
}: SurfaceProps) {
  const classes = [styles["surface"], className].filter(Boolean).join(" ");

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
