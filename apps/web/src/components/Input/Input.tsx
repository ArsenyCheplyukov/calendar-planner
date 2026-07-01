import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...rest },
  ref,
) {
  const classes = [styles["input"], className].filter(Boolean).join(" ");

  return (
    <input
      ref={ref}
      className={classes}
      data-invalid={invalid ? "true" : undefined}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
