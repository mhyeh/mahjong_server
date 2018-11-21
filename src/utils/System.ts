export function Delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function DelayValue<T>(ms: number, value: T): Promise<T> {
    return new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
}
