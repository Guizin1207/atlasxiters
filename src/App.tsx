import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyProvider } from "@/lib/key-context";
import { AdminProvider } from "@/lib/admin-context";
import { AuthProvider } from "@/lib/auth-context";
import LoginPage from "./pages/Login";
import PainelPage from "./pages/Painel";
import AdminPage from "./pages/Admin";
import AdminLoginPage from "./pages/AdminLogin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="bottom-center" theme="dark" richColors closeButton />
      <BrowserRouter>
        <AuthProvider>
          <KeyProvider>
            <AdminProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/painel" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/painel" element={<PainelPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AdminProvider>
          </KeyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
