import { useEffect, useState } from "react";
import "./App.css";

type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/health`);

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        setHealth((await response.json()) as HealthResponse);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to reach the backend",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadHealth();
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">agDataCollection</p>
        <h1>React + Express 全栈项目已就绪</h1>
        <p className="hero-description">
          前端运行在 Vite，后端运行在 Express。开发时可以通过统一脚本同时启动两端。
        </p>

        <div className="status-card" role="status" aria-live="polite">
          <div className="status-indicator" data-online={Boolean(health)} />
          <div>
            <p className="status-label">Backend status</p>
            {isLoading && <p className="status-value">正在检查后端连接…</p>}
            {!isLoading && health && (
              <p className="status-value">连接正常 · {health.service}</p>
            )}
            {!isLoading && error && (
              <p className="status-value status-error">连接失败 · {error}</p>
            )}
          </div>
        </div>

        <div className="stack-list" aria-label="技术栈">
          <span>React</span>
          <span>TypeScript</span>
          <span>Vite</span>
          <span>Express</span>
        </div>
      </section>
    </main>
  );
}

export default App;
