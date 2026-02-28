import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<Placeholder name="Login" />} />
        <Route path="/" element={<Placeholder name="Dashboard" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
