import * as React from 'react';
import type {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  TextInput,
  TextInputFocusEventData,
  TextInputProps,
} from 'react-native';

import { FormContext, FormContextType } from './FormContext';
import { useLatest, useReferencedCallback } from './utils';

import objectPath from 'object-path';

type FormTextInputProps = {
  testID: string;
  value: string;
  onBlur: TextInputProps['onBlur'];
  onLayout: TextInputProps['onLayout'];
  onChangeText: TextInputProps['onChangeText'];
  textContentType?: TextInputProps['textContentType'];
  autoCompleteType?: TextInputProps['autoCompleteType'];
  keyboardType?: TextInputProps['keyboardType'];
  secureTextEntry?: TextInputProps['secureTextEntry'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: TextInputProps['autoCorrect'];
  selectTextOnFocus?: TextInputProps['selectTextOnFocus'];
};

type FormRawProps<V> = {
  value: V;
  onChange: (v: V) => void;
};

type Customizing<T, Key extends keyof T> = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;

  validate?: (v: T[Key], values: T) => boolean | string | undefined;
  onChangeText?: TextInputProps['onChangeText'];
  onBlur?: TextInputProps['onBlur'];
  onLayout?: TextInputProps['onLayout'];
};

type CustomizingRaw<V, T> = {
  validate?: (v: V, values: T) => void;
};

type FormRawType<T> = <K extends keyof T>(
  key: K,
  handlers?: CustomizingRaw<T[K], T>
) => FormRawProps<T[K]>;

type FormTextType<T> = (
  key: keyof T,
  handlers?: Customizing<T, keyof T>
) => FormTextInputProps;

type FieldsBoolean<T> = {
  [key in keyof T]?: boolean;
};
type FieldsError<T> = {
  [key in keyof T]?: boolean | string | undefined;
};

type ReferencerReturns = TextInputProps & { ref: React.Ref<TextInput> };
export type ReferencerType = (
  key: string,
  formIndex: number
) => ReferencerReturns;

export type IndexerType = {
  add: () => number;
  i: number;
};

// we need something to keep track of nested forms
export function indexer(): IndexerType {
  let i: number = 0;
  function add() {
    i++;
    return i;
  }
  return {
    add,
    i,
  };
}

export function useFormContext(): FormContextType & {
  formIndex: number;
} {
  const px = React.useContext(FormContext);
  const ix = useInnerContext(!!px);
  const ctx = (px || ix)!;
  const idx = React.useRef<number>(px ? px.indexer.add() : ctx.indexer.i);
  return {
    ...ctx,
    formIndex: idx.current,
  };
}

type IndexKeyMap = Record<string, number>;
type RefKeyMap = Record<string, TextInput>;

type FormIndexKeyMap = Record<number, IndexKeyMap>;
export type FormRefKeyMap = Record<number, RefKeyMap>;

export function useInnerContext(skip?: boolean) {
  // const formIndex = React.useRef<number>(0);
  const [lastKey, setLastKey] = React.useState<string | undefined>(undefined);
  const refIndex = React.useRef<number>(0);

  const indexForKey = React.useRef<FormIndexKeyMap>({});
  const refForKey = React.useRef<FormRefKeyMap>({});
  const referencedCallback = useReferencedCallback();

  React.useEffect(() => {
    // we would rather not do this hook at all, but we need to keep amount of hooks the same :)
    if (skip) {
      return;
    }
    const elements = Object.keys(refForKey.current).filter(
      (key, _) => refForKey.current[key as any] !== null
    );
    const lKey = elements[elements.length - 1];

    if (lastKey !== lKey) {
      setLastKey(lKey);
    }
  }, [skip, lastKey, setLastKey, refForKey]);

  // we would rather not do this hook at all, but we need to keep amount of hooks the same :)
  if (skip) {
    return undefined;
  }

  const referencer: ReferencerType = (key, formIndex) => {
    return {
      ref: referencedCallback(`ref.${key}`, (e: TextInput) => {
        if (e === null) {
          return;
        }

        const rk = refForKey.current;
        const ik = indexForKey.current;
        // set default state if undefined
        rk[formIndex] = rk[formIndex] || {};
        ik[formIndex] = ik[formIndex] || {};

        const index = rk[formIndex][key];
        if (index === undefined) {
          refIndex.current = refIndex.current + 1;
          ik[formIndex][key] = refIndex.current;
        }
        rk[formIndex][key] = e;
      }),
      onSubmitEditing:
        lastKey === key
          ? undefined
          : referencedCallback(`focusNext.${key}`, () => {
              const rk = refForKey.current[formIndex] || {};
              const ik = indexForKey.current[formIndex] || {};
              const currentField = rk[key];

              // combine fields of current and next form
              const fields = Object.keys(refForKey.current)
                .map((frmKey) => {
                  const fi = Number(frmKey);
                  const refs = refForKey.current[fi];
                  const ixs = indexForKey.current[fi];
                  return Object.keys(refs)
                    .filter((e) => !!e)
                    .map((k) => ({
                      element: refs[k],
                      index: ixs[k],
                      fi,
                    }))
                    .sort((a, b) => a.fi - b.fi && a.index - b.index);
                })
                .flat();

              const nextField = fields.find((f) => {
                const p = f.element.props;
                // skip disabled fields in focus
                if ((p as any).disabled === true || p.editable === false) {
                  return false;
                }
                // already sorted so the first one to hit above current index is the next field
                return f.index > ik[key];
              });

              nextField?.element?.focus?.();
              currentField?.blur();
            }),
      blurOnSubmit: lastKey === key,
      returnKeyType: lastKey === key ? undefined : 'next',
    };
  };

  return { referencer, indexer: indexer(), refForKey };
}

export default function useFormState<T>(
  initialState: T,
  options?: {
    onChange?: (newState: T) => void;
    onSubmit?: (newState: T) => void;
  }
): [
  {
    values: T;
    errors: FieldsError<T>;
    touched: FieldsBoolean<T>;
    setField: <K extends keyof T>(key: K, value: T[K]) => void;
    setValues: (values: T) => void;
    setTouched: <K extends keyof T>(key: K, value: boolean) => void;
    setError: <K extends keyof T>(
      key: K,
      value: boolean | string | undefined
    ) => void;
    clearErrors: () => void;
    submit: () => void;
    formProps: {
      indexer: IndexerType;
      referencer: ReferencerType;
    };
    hasError: <K extends keyof T>(key: K) => boolean;
  },
  {
    decimalText: FormTextType<T>;
    numberText: FormTextType<T>;
    decimal: FormTextType<T>;
    number: FormTextType<T>;
    text: FormTextType<T>;

    username: FormTextType<T>;
    password: FormTextType<T>;
    email: FormTextType<T>;
    postalCode: FormTextType<T>;
    streetAddress: FormTextType<T>;
    telephone: FormTextType<T>;
    name: FormTextType<T>;
    city: FormTextType<T>;
    raw: FormRawType<T>;
  }
] {
  const referencedCallback = useReferencedCallback();
  const ctx = useFormContext();
  const [wasSubmitted, setWasSubmitted] = React.useState<boolean>(false);
  const [touched, sTouched] = React.useState<FieldsBoolean<T>>({});
  const [errors, sErrors] = React.useState<FieldsError<T>>({});
  const [values, innerSetValues] = React.useState<T>(initialState);

  const valuesRef = useLatest(values);
  const onChangeRef = useLatest(options?.onChange);
  const errorsRef = useLatest(errors);

  const setError = React.useCallback(
    <K extends keyof T>(k: K, v: boolean | string | undefined) => {
      if (v !== errorsRef.current[k]) {
        sErrors((prev) => ({
          ...prev,
          [k]: v,
        }));
      }
    },
    [errorsRef, sErrors]
  );

  const clearErrors = React.useCallback(() => {
    sErrors({});
  }, []);

  const checkError = React.useCallback(
    <K extends keyof T>(
      k: K,
      h: Customizing<T, keyof T> | undefined,
      v: T[K],
      allV: T
    ) => {
      let err: boolean | string | undefined;

      if (h) {
        err = h.validate?.(v, allV);
        if (!err) {
          if (h?.required === true && !v) {
            err = `${k} is required`;
          } else if (h.minLength !== undefined && `${v}`.length < h.minLength) {
            err = `${k} should be more than ${h.minLength}`;
          } else if (h.maxLength !== undefined && `${v}`.length > h.maxLength) {
            err = `${k} should be less than ${h.maxLength}`;
          }
        }
      }

      setError(k, err === true ? false : err);
    },
    [setError]
  );

  const changeValue = React.useCallback(
    <K extends keyof T>(
      k: K,
      v: T[K],
      h: Customizing<T, keyof T> | undefined
    ) => {
      let newValues = {
        ...valuesRef.current,
      };
      if ((k as string).includes('.')) {
        objectPath.set((newValues as unknown) as object, k as string, v);
      } else {
        newValues = {
          ...valuesRef.current,
          [k]: v,
        };
      }

      h?.onChangeText?.((v as any) as string);
      innerSetValues(newValues);

      checkError(k, h, v, valuesRef.current);

      // prevent endless re-render if called on nested form
      // TODO: not needed anymore probably test it out
      setTimeout(() => {
        onChangeRef?.current?.(newValues);
      }, 0);
    },
    [innerSetValues, onChangeRef, valuesRef, checkError]
  );

  const onSubmitRef = useLatest(options?.onSubmit);

  const submit = React.useCallback(() => {
    setWasSubmitted(true);
    // if it returns an object there are errors
    const errorCount = Object.keys(errorsRef.current)
      .map((key) => !!errorsRef.current[key as keyof T])
      .filter((n) => n).length;
    if (errorCount > 0) {
      return;
    }

    onSubmitRef?.current?.(valuesRef.current);
  }, [errorsRef, valuesRef, onSubmitRef]);

  const blur = <K extends keyof T>(
    k: K,
    h: Customizing<T, keyof T> | undefined
  ): TextInputProps['onBlur'] =>
    referencedCallback(
      `blur.${k}`,
      (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
        h?.onBlur?.(e);
        setTouched(k, true);
      }
    );

  const layout = <K extends keyof T>(
    k: K,
    h: Customizing<T, keyof T> | undefined
  ): TextInputProps['onLayout'] =>
    referencedCallback(`layout.${k}`, (e: LayoutChangeEvent) => {
      h?.onLayout?.(e);
      const values = valuesRef.current;
      const value = values[k];
      checkError(k, h, value, values);
    });

  const text = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...ctx.referencer(k as any, ctx.formIndex),
    testID: k as string,
    onChangeText: referencedCallback(`text.${k}`, (n: T[K]) =>
      changeValue(k, n, h)
    ),
    onLayout: layout(k, h),
    onBlur: blur(k, h),
    value: objectPath.get(values as any, k as string),
  });

  const numberRaw = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...ctx.referencer(k as any, ctx.formIndex),
    testID: k as string,
    onChangeText: referencedCallback(`number.${k}`, (n: string) => {
      if (n !== '') {
        changeValue(k, Number(n) as any, h);
      }
    }),
    onBlur: blur(k, h),
    onLayout: layout(k, h),
    value: `${objectPath.get(values as any, k as string)}`,
  });

  const number = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...numberRaw(k, h),
    keyboardType: 'number-pad',
  });

  const decimal = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...numberRaw(k, h),
    keyboardType: 'decimal-pad',
  });

  const numberText = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    keyboardType: 'number-pad',
  });

  const decimalText = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    keyboardType: 'decimal-pad',
  });

  const postalCode = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    autoCapitalize: 'characters',
    textContentType: 'postalCode',
    autoCompleteType: 'postal-code',
    autoCorrect: false,
  });

  const streetAddress = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    autoCapitalize: 'words',
    autoCompleteType: 'street-address',
    autoCorrect: false,
  });

  const city = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    autoCapitalize: 'words',
    textContentType: 'addressCity',
    autoCorrect: false,
  });

  const telephone = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    textContentType: 'telephoneNumber',
    autoCompleteType: 'tel',
    keyboardType: 'phone-pad',
    autoCorrect: false,
  });

  const name = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    autoCapitalize: 'words',
    autoCompleteType: 'name',
    autoCorrect: false,
  });

  const username = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    textContentType: 'username',
    autoCompleteType: 'username',
    autoCapitalize: 'none',
    autoCorrect: false,
    selectTextOnFocus: true,
  });

  const password = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    textContentType: 'password',
    autoCompleteType: 'password',
    secureTextEntry: true,
    autoCorrect: false,
    selectTextOnFocus: true,
  });

  const email = <K extends keyof T>(
    k: K,
    h?: Customizing<T, keyof T>
  ): FormTextInputProps => ({
    ...text(k, h),
    textContentType: 'emailAddress',
    autoCompleteType: 'email',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
  });

  const raw = <K extends keyof T>(
    k: K,
    h?: CustomizingRaw<T[K], T>
  ): FormRawProps<T[K]> => ({
    onChange: referencedCallback(`raw.${k}`, (n: T[K]) => {
      setTouched(k, true);
      changeValue(k, n, h as any);
    }),
    value: objectPath.get(values as any, k as string) as T[K],
  });

  const setField = <K extends keyof T>(k: K, v: T[K]) => {
    if (v !== values[k]) {
      changeValue(k, v, undefined);
    }
  };

  const setValues = (v: T) => {
    if (v !== values) {
      innerSetValues(v);
    }
  };

  const setTouched = <K extends keyof T>(k: K, v: boolean) => {
    if (v !== touched[k]) {
      sTouched((p) => ({
        ...p,
        [k]: v,
      }));
    }
  };

  const hasError = <K extends keyof T>(k: K): boolean => {
    let realKey = k;
    if (touched[realKey] || wasSubmitted) {
      const noError =
        errors[realKey] === false || errors[realKey] === undefined;
      return !noError;
    }
    return false;
  };

  return [
    {
      values,
      errors,
      touched,
      setField,
      setValues,
      setError,
      setTouched,
      submit,
      formProps: { referencer: ctx.referencer, indexer: ctx.indexer },
      hasError,
      clearErrors,
    },
    {
      text,
      username,
      number,
      decimal,
      numberText,
      decimalText,
      password,
      email,
      raw,
      postalCode,
      streetAddress,
      name,
      telephone,
      city,
    },
  ];
}
