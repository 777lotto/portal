interface UserPayload {
    name: string;
    role: 'admin' | 'customer';
}
interface Props {
    token: string | null;
    setToken: (token: string | null) => void;
    user: UserPayload | null;
}
export default function Navbar({ token, setToken, user }: Props): import("react/jsx-runtime").JSX.Element;
export {};
