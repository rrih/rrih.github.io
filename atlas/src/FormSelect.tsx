import { formLabel, formsFor } from './forms'
import { useLocale } from './i18n'

export default function FormSelect({
  speciesId,
  value,
  onChange,
}: {
  speciesId: number
  value?: string
  onChange: (id: string) => void
}) {
  const { t } = useLocale()
  const options = formsFor(speciesId)
  if (!options.length) return null
  return (
    <label className="form-select">
      <span>{t('Form')}</span>
      <select aria-label={t('Form')} value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t('Standard form')}</option>
        {options.map((form) => (
          <option key={form.id} value={form.id}>
            {formLabel(form, t)}
          </option>
        ))}
      </select>
    </label>
  )
}
