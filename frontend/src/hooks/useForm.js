import { useCallback, useState } from 'react';

/**
 * Small form-state helper: values, field errors (client or API), submitting flag.
 * `validate(values)` returns { field: message } for client-side checks; API
 * validation errors (err.fieldErrors) are merged in on submit failure.
 */
export function useForm(initialValues, { validate, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => setField(name, e.target.type === 'checkbox' ? e.target.checked : e.target.value),
    error: errors[name],
  });

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const clientErrors = validate ? validate(values) : {};
    const hasErrors = Object.values(clientErrors).some(Boolean);
    setErrors(clientErrors);
    if (hasErrors) return;
    setSubmitting(true);
    setFormError('');
    try {
      await onSubmit(values);
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors);
        setFormError('Please correct the highlighted fields.');
      } else {
        setFormError(err.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, setField, errors, setErrors, formError, submitting, bind, handleSubmit };
}
