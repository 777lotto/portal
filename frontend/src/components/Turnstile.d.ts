interface TurnstileProps {
    sitekey: string;
    onVerify: (token: string) => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact';
    key?: string;
}
export default function Turnstile({ sitekey, onVerify, theme, size, key }: TurnstileProps): import("react/jsx-runtime").JSX.Element;
declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: {
                sitekey: string;
                callback: (token: string) => void;
                theme?: 'light' | 'dark' | 'auto';
                size?: 'normal' | 'compact';
                'refresh-expired'?: 'auto' | 'manual';
            }) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
        };
    }
}
export {};
