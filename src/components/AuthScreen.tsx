/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User, UserRole } from "../types";
import { KeyRound, Mail, User as UserIcon, Building2, Phone, Shield, CreditCard, RefreshCw } from "lucide-react";
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  doc, 
  setDoc, 
  getDoc 
} from "../lib/firebase";

interface AuthScreenProps {
  onLogin: (user: User) => void;
  existingUsers: User[];
  onRegister: (newUser: User) => void;
}

export default function AuthScreen({ onLogin, existingUsers, onRegister }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  
  // Register fields
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState<UserRole>("Frentista");
  const [cnpjPosto, setCnpjPosto] = useState("12.345.678/0001-99");
  const [telefone, setTelefone] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!email || !password) {
      setError("Por favor, preencha todos os campos.");
      setLoading(false);
      return;
    }

    try {
      let firebaseUser;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = userCredential.user;
      } catch (signInErr: any) {
        // Auto-seed mock users if they try login with legacy credentials
        const mockUser = existingUsers.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.senhaCriptografada === password
        );
        if (mockUser) {
          try {
            const createCred = await createUserWithEmailAndPassword(auth, email, password);
            firebaseUser = createCred.user;
            await setDoc(doc(db, "users", firebaseUser.uid), {
              id: firebaseUser.uid,
              nomeCompleto: mockUser.nomeCompleto,
              email: mockUser.email,
              senhaCriptografada: mockUser.senhaCriptografada,
              cpf: mockUser.cpf,
              cargo: mockUser.cargo,
              cnpjPosto: mockUser.cnpjPosto,
              telefone: mockUser.telefone || "",
            });
          } catch (createErr: any) {
            throw signInErr;
          }
        } else {
          throw signInErr;
        }
      }

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        onLogin(userDocSnap.data() as User);
      } else {
        const fallbackUser: User = {
          id: firebaseUser.uid,
          nomeCompleto: email.split("@")[0].toUpperCase(),
          email: email,
          senhaCriptografada: password,
          cpf: "000.000.000-00",
          cargo: "Frentista",
          cnpjPosto: "12.345.678/0001-99",
          telefone: "",
        };
        await setDoc(userDocRef, fallbackUser);
        onLogin(fallbackUser);
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Erro ao fazer login: " + (err.message || "Erro desconhecido");
      const errString = String(err).toLowerCase();
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-email" || errString.includes("invalid-credential") || errString.includes("wrong-password")) {
        errorMsg = "E-mail ou senha incorretos.";
      } else if (err.code === "auth/user-not-found" || errString.includes("user-not-found")) {
        errorMsg = "Usuário não cadastrado. Por favor, cadastre-se primeiro.";
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!nomeCompleto || !email || !password || !cpf || !cnpjPosto) {
      setError("Por favor, preencha todos os campos obrigatórios (*).");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const newUser: User = {
        id: firebaseUser.uid,
        nomeCompleto,
        email,
        senhaCriptografada: password,
        cpf,
        cargo,
        cnpjPosto,
        telefone,
      };

      await setDoc(doc(db, "users", firebaseUser.uid), newUser);
      onRegister(newUser);
      setSuccess("Cadastro realizado com sucesso via Firebase! Faça seu login.");
      setIsLogin(true);
      
      setNomeCompleto("");
      setEmail("");
      setPassword("");
      setCpf("");
      setTelefone("");
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Erro ao registrar usuário: " + err.message;
      if (err.code === "auth/email-already-in-use") {
        errorMsg = "Este e-mail já está sendo utilizado por outro usuário.";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "A senha deve possuir no mínimo 6 caracteres.";
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!forgotEmail) {
      setError("Por favor, informe seu e-mail.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setSuccess("E-mail de recuperação enviado com sucesso para " + forgotEmail + "!");
      setIsForgotPassword(false);
      setForgotEmail("");
    } catch (err: any) {
      console.error(err);
      setError("Erro ao enviar e-mail de recuperação: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-indigo-600 text-white mb-4 shadow-sm">
          <Building2 className="h-8 w-8" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 font-display">
          Meu Posto
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Gestão Inteligente e Alta Performance para Postos de Combustíveis
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-lg">
              {success}
            </div>
          )}

          {isForgotPassword ? (
            <form className="space-y-6" onSubmit={handleForgotPasswordSubmit} id="forgot-password-form">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Recuperar Senha</h3>
                <p className="text-xs text-slate-500 mb-4">Insira o e-mail cadastrado e enviaremos um link para redefinir sua senha.</p>
                <label className="block text-sm font-medium text-slate-700">
                  E-mail de Cadastro
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="seu-email@exemplo.com"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition duration-150 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    "Enviar E-mail"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50"
                >
                  Voltar
                </button>
              </div>
            </form>
          ) : isLogin ? (
            <form className="space-y-6" onSubmit={handleLoginSubmit} id="login-form">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  E-mail do Usuário
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="exemplo@meuposto.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-slate-700">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  id="btn-entrar"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition duration-150 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    "Entrar no Sistema"
                  )}
                </button>
              </div>

              <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span className="block mb-2 font-medium">Credenciais padrão para testes rápidos (Firebase auto-seeding):</span>
                <div className="bg-slate-50 p-2 rounded-lg text-left space-y-1 font-mono text-[11px] text-slate-600 border border-slate-150">
                  <div><strong>Master:</strong> carlos@meuposto.com (carlos123)</div>
                  <div><strong>Gerente:</strong> mariana@meuposto.com (mariana123)</div>
                  <div><strong>Frentista:</strong> marcos@meuposto.com (marcos123)</div>
                </div>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegisterSubmit} id="register-form">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Nome Completo *
                </label>
                <div className="mt-1 relative rounded-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value)}
                    className="block w-full pl-10 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="Carlos Souza"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  E-mail Corporativo *
                </label>
                <div className="mt-1 relative rounded-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="frentista@posto.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Senha *
                </label>
                <div className="mt-1 relative rounded-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    CPF *
                  </label>
                  <div className="mt-1 relative rounded-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="block w-full pl-9 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="123.456.789-00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Cargo *
                  </label>
                  <div className="mt-1 relative rounded-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Shield className="h-4 w-4" />
                    </div>
                    <select
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value as UserRole)}
                      className="block w-full pl-9 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none cursor-pointer"
                    >
                      <option value="Frentista">Frentista</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Gerente">Gerente</option>
                      <option value="Master">Master</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  CNPJ do Posto *
                </label>
                <div className="mt-1 relative rounded-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={cnpjPosto}
                    onChange={(e) => setCnpjPosto(e.target.value)}
                    className="block w-full pl-10 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="12.345.678/0001-99"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Telefone
                </label>
                <div className="mt-1 relative rounded-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="block w-full pl-10 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="(11) 99999-8888"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="btn-cadastrar"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition duration-150 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    "Registrar Usuário"
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setIsForgotPassword(false);
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition duration-150 cursor-pointer"
            >
              {isForgotPassword ? "Voltar ao Login" : isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem registro? Faça o Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
