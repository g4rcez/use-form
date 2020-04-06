import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useReducer from "use-typed-reducer";

type FieldMessage<T> = {
  [key in keyof T]?: { message: any; hasError: boolean };
};

const isEmpty = (object?: Object) => {
  if (object === undefined || object === null) {
    return true;
  }
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
};

export type BlurEvent<T> = {
  state: T;
  setState(newProps: Partial<T>): any;
  setErrors(errorsObject: FieldMessage<T>): any;
};

type BlurFn<T> = (
  event: React.FocusEvent<HTMLInputElement>,
  props: BlurEvent<T>
) => void;

type Blur<T> = { [key in keyof T]?: BlurFn<T> };

type FunctionValidate<State, Key extends keyof State> = (
  field: State[Key],
  state: State
) => { isValid: boolean; msg: string };

type Validations<State> = {
  [key in keyof State]?: FunctionValidate<State, key>;
};

type UseFormType<State> = {
  blurs?: Blur<State>;
  updateOnChange?: boolean;
  validations?: Validations<State>;
};

const getKeys = Object.keys;

const fill = (obj: { [key: string]: any }, etc: any) =>
  getKeys(obj).reduce((acc, e) => ({ ...acc, [e]: etc }), {});

const checkKeys = (o1: Object, o2: Object, key: string) =>
  o1.hasOwnProperty(key) && o2.hasOwnProperty(key);

const actions = {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = event.target;
    const isCheckbox = type === "checkbox";
    const fieldValue = isCheckbox ? checked : value;
    return (state: any) => ({
      ...state,
      fields: { ...state.fields, [name]: fieldValue },
    });
  },
  cleanUpErrors: () => (state: any) => ({ ...state, errors: {} }),
  updateErrors: (errors: any) => (state: any) => ({ ...state, errors }),
  setState: (update: any) => (state: any) => ({
    ...state,
    fields: { ...state.fields, ...update },
  }),
  aggregateErrors: (errors: any) => (state: any) => ({
    ...state,
    errors: { ...state.errors, ...errors },
  }),
};

const messageFill = { message: "", hasError: false };

type Maybe<T> = T | null | undefined;

type InputTypes = Maybe<string | number | boolean | any>;

const useForm = <T extends { [key in keyof T]: InputTypes }>(
  fields: T,
  {
    updateOnChange = true,
    validations = {} as any,
    blurs = {} as Blur<T>,
  }: UseFormType<T> = {}
): {
  clearState(): any;
  onChange(event: React.ChangeEvent<HTMLInputElement>): any;
  setState(newProps: Partial<T>): any;
  setErrors(errors: FieldMessage<T>): any;
  blurEvents: Blur<T>;
  hasErrors: boolean;
  allMatch: boolean;
  errors: FieldMessage<T>;
  state: T;
} => {
  const [initialState] = useState(fields);
  const cache: any = useRef(fill(fields, false));
  const internalErrors = useMemo(() => fill(fields, messageFill), [
    fields,
  ]) as FieldMessage<T>;

  const [state, dispatch] = useReducer(
    { fields, errors: internalErrors },
    actions,
    false
  );
  const values: any = state.fields;

  const setState = useCallback(
    (newProps: Partial<T>) => dispatch.setState(newProps),
    []
  );

  const setErrors = useCallback(
    (errors: FieldMessage<T>) => dispatch.aggregateErrors(errors),
    []
  );

  const clearState = useCallback(
    (emptyState: Partial<T> = initialState) => dispatch.setState(emptyState),
    [initialState]
  );

  useEffect(() => {
    if (updateOnChange) {
      getKeys(state.fields).forEach((x) => {
        const value = (state.fields as any)[x];
        if (checkKeys(validations, state.fields, x) && !!value) {
          const fn = (validations as any)[x];
          const { isValid: error, msg } = fn(value, state.fields);
          if (error) {
            cache.current[x] = true;
          }
          if (cache.current[x]) {
            (internalErrors as any)[x] = { message: msg, hasError: !error };
          }
        }
      });
      if (isEmpty(internalErrors)) {
        dispatch.cleanUpErrors();
      } else {
        dispatch.updateErrors(internalErrors);
      }
    }
  }, [state.fields, validations, updateOnChange]);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.persist();
    return dispatch.onChange(event);
  };

  const blurEvents = useMemo(
    () =>
      getKeys(blurs).reduce((acc, el) => {
        if (!!blurs && blurs.hasOwnProperty(el)) {
          const validationFn = (validations as any)[el] || undefined;
          const onBlurHandler = (event: React.FocusEvent<HTMLInputElement>) => {
            if (!!validationFn) {
              const validation = validationFn(event.target.value, state.fields);
              if (!validation.isValid) {
                dispatch.aggregateErrors({
                  [el]: { hasError: true, message: validation.msg },
                });
              }
            }
            return ((blurs as any)[el] as any)(event, {
              state: state.fields,
              setState,
              setErrors,
            });
          };
          (acc as any)[el] = onBlurHandler;
        }
        return acc;
      }, {} as Blur<T>),
    [state.fields, blurs, validations]
  );

  const allMatch = useMemo(
    () =>
      Object.entries(validations).every((info: any) => {
        const [key, fn]: [keyof T, FunctionValidate<T, any>] = info;
        const result = fn((state.fields as any)[key], state.fields);
        return result.isValid;
      }),
    [state.fields, validations]
  );

  const hasErrors = useMemo(() => !allMatch, [allMatch]);

  return {
    clearState,
    allMatch,
    hasErrors,
    onChange,
    setState,
    setErrors,
    blurEvents,
    errors: state.errors,
    state: values,
  };
};

export default useForm;
