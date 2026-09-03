import { AppText, type AppTextProps } from "@/components/ui/typography/app-text";
import { type CurrencyDisplay, format, type Money } from "@/lib/money/money";

// TODO: replace with your locale source (i18n hook / settings store).
// Locale is app configuration, never network data, so a default here is safe.
const DEFAULT_LOCALE = "de-CH";

export type MoneyTextProps = Omit<AppTextProps, "children"> & {
  money: Money;
  locale?: string;
  display?: CurrencyDisplay;
};

/**
 * The one way to put an amount on screen. Takes a valid Money only; if a value
 * could not be decoded that is a view-model concern, decided before render.
 *
 * Reads "1’234.50 Swiss francs" to screen readers instead of "C H F".
 */
export function MoneyText({
  money,
  locale = DEFAULT_LOCALE,
  display = "symbol",
  variant = "bodyStrong",
  accessibilityLabel,
  ...rest
}: MoneyTextProps) {
  return (
    <AppText
      variant={variant}
      accessibilityLabel={accessibilityLabel ?? format(money, locale, "name")}
      {...rest}
    >
      {format(money, locale, display)}
    </AppText>
  );
}
