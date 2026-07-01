import { forwardRef, type TextareaHTMLAttributes } from "react";
import styles from "./Textarea.module.css";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid = false, className, ...rest }, ref) {
    const classes = [styles["textarea"], className].filter(Boolean).join(" ");
    return (
      <textarea
        ref={ref}
        className={classes}
        data-invalid={invalid ? "true" : undefined}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);
