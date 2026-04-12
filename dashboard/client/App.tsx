import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Runs from "./pages/Runs";
import Cases from "./pages/Cases";
import Sources from "./pages/Sources";
import Reflections from "./pages/Reflections";

const navItems = [
  { path: "/", label: "ダッシュボード" },
  { path: "/runs", label: "実行履歴" },
  { path: "/cases", label: "事例" },
  { path: "/sources", label: "ソース" },
  { path: "/reflections", label: "振り返り" },
];

export default function App() {
  return (
    <div className="flex min-h-screen">
      <nav className="w-60 bg-slate-800 border-r border-slate-700 p-4 flex-shrink-0">
        <h1 className="text-lg font-semibold text-slate-100 mb-6">
          usecase-agent
        </h1>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded text-sm ${
                    isActive
                      ? "bg-blue-500/20 text-blue-400 font-medium"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/reflections" element={<Reflections />} />
        </Routes>
      </main>
    </div>
  );
}
