import { useEffect, useMemo, useRef, useCallback } from "react";
import useReducer from "use-typed-reducer";
type FieldMessage<T> = { [key in keyof T]?: { message: any; hasError: boolean } };

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
type Blur<T> = {
	[key: string]: (event: React.FocusEvent<HTMLInputElement>, props: BlurEvent<T>) => any;
};

type UseFormType<State> = {
	blurs?: Blur<State>;
	updateOnChange?: boolean;
	validations?: { [key: string]: (fieldValue: any, state: State) => { isValid: boolean; msg: string } } & Object;
};

const getKeys = Object.keys;

const fill = (obj: { [key: string]: any }, etc: any) => getKeys(obj).reduce((acc, e) => ({ ...acc, [e]: etc }), {});

const checkKeys = (o1: Object, o2: Object, key: string) => o1.hasOwnProperty(key) && o2.hasOwnProperty(key);

const actions = {
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value, checked, type } = event.target;
		const isCheckbox = type === "checkbox";
		const fieldValue = isCheckbox ? checked : value;
		return (state: any) => ({ ...state, fields: { ...state.fields, [name]: fieldValue } });
	},
	cleanUpErrors: () => (state: any) => ({ ...state, errors: {} }),
	updateErrors: (errors: any) => (state: any) => ({ ...state, errors }),
	setState: (update: any) => (state: any) => ({ ...state, fields: { ...state.fields, ...update } }),
	aggregateErrors: (errors: any) => (state: any) => ({ ...state, errors: { ...state.errors, ...errors } })
};

const messageFill = { message: "", hasError: false };

type Maybe<T> = T | null | undefined;
type InputTypes = Maybe<string | number | boolean | any>;
export default <T extends { [key in keyof T]: InputTypes }>(
	fields: T,
	{ updateOnChange = true, validations = {}, blurs = {} }: UseFormType<T> = {}
) => {
	const cache: any = useRef(fill(fields, false));
	const internalErrors = useMemo(() => fill(fields, messageFill), [fields]) as FieldMessage<T>;

	const [state, dispatch] = useReducer({ fields, errors: internalErrors }, actions, false);
	const values: any = state.fields;
	const valuesDependency = Object.values(values);

	const setState = useMemo(() => (newProps: Partial<T>) => dispatch.setState(newProps), []);

	const setErrors = useMemo(() => (errors: FieldMessage<T>) => dispatch.aggregateErrors(errors), []);

	const clearState = useCallback((emptyState?: Partial<T>) => dispatch.setState({ ...fields, ...emptyState }), []);

	useEffect(() => {
		if (updateOnChange) {
			getKeys(values).forEach((x) => {
				const value = values[x];
				if (checkKeys(validations, values, x) && !!value) {
					const fn = validations[x];
					const { isValid: error, msg } = fn(value, values);
					if (error) {
						cache.current[x] = true;
					}
					if (cache.current[x]) {
						internalErrors[x] = { message: msg, hasError: !error };
					}
				}
			});
			if (isEmpty(internalErrors)) {
				dispatch.cleanUpErrors();
			} else {
				dispatch.updateErrors(internalErrors);
			}
		}
	}, valuesDependency);

	const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		event.persist();
		return dispatch.onChange(event);
	};

	const blurEvents: any = useMemo(
		() =>
			getKeys(blurs).reduce((acc, el) => {
				if (!!blurs && blurs.hasOwnProperty(el)) {
					const validationFn = validations[el] || undefined;
					const onBlurHandler = (event: React.FocusEvent<HTMLInputElement>) => {
						if (!!validationFn) {
							const validation = validationFn(event.target.value, state.fields);
							if (!validation.isValid) {
								dispatch.aggregateErrors({ [el]: { hasError: true, message: validation.msg } });
							}
						}
						return (blurs[el] as any)(event, {
							state: state.fields,
							setState,
							setErrors
						});
					};
					return { ...acc, [el]: onBlurHandler };
				}
				return acc;
			}, {}),
		valuesDependency
	);

	return { clearState, onChange, setState, setErrors, blurEvents, errors: state.errors, state: values };
};
