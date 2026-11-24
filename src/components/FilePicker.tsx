import { useRef, type InputHTMLAttributes, type RefObject } from "react";
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  emptyText: string;
  fileNames: string[];
  inputRef?: RefObject<HTMLInputElement>;
};
export default function FilePicker({
  label,
  emptyText,
  fileNames,
  inputRef,
  ...props
}: Props) {
  const ownRef = useRef<HTMLInputElement>(null),
    ref = inputRef ?? ownRef;
  const description = fileNames.length ? fileNames.join("、") : emptyText;
  return (
    <div className="localized-file-picker">
      <input {...props} ref={ref} type="file" hidden aria-label={label} />
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => ref.current?.click()}
      >
        {label}
      </button>
      <span title={description}>{description}</span>
    </div>
  );
}
