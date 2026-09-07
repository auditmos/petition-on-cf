import { Input } from "@/components/ui/input";

/**
 * One labelled text input, with whatever the schema said about it.
 *
 * Both groups of fields render identically — the organisation's two and the
 * signer's five — so they render through one thing. It takes values rather
 * than a field controller so that it stays a plain component with no opinion
 * about which form library produced them.
 */
export function TextField({
	name,
	label,
	autoComplete,
	type = "text",
	value,
	error,
	onBlur,
	onChange,
}: {
	name: string;
	label: string;
	autoComplete: string;
	type?: "text" | "email";
	value: string;
	error: string | undefined;
	onBlur: () => void;
	onChange: (value: string) => void;
}) {
	return (
		<div>
			<label htmlFor={name} className="block text-sm font-medium text-ink">
				{label}
			</label>
			<Input
				id={name}
				name={name}
				type={type}
				autoComplete={autoComplete}
				value={value}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? `-error` : undefined}
				onBlur={onBlur}
				onChange={(event) => onChange(event.target.value)}
				className="mt-2"
			/>
			{error ? (
				<p id={`-error`} role="alert" className="mt-2 text-sm text-negative">
					{error}
				</p>
			) : null}
		</div>
	);
}
