// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Client = {
  url: string;
  visibilityState: "visible" | "hidden";
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
};

function workerHarness(clients: Client[] = []) {
  const listeners = new Map<string, (event: any) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi.fn().mockResolvedValue(clients),
      openWindow,
    },
    registration: { showNotification },
    location: { origin: "https://atlas.test" },
    addEventListener(type: string, listener: (event: any) => void) {
      listeners.set(type, listener);
    },
    skipWaiting: vi.fn(),
  };
  vm.runInNewContext(readFileSync(resolve("public/sw.js"), "utf8"), {
    self,
    URL,
    Map,
    Date,
  });

  async function push(data: Record<string, unknown>) {
    let pending: Promise<unknown> | undefined;
    listeners.get("push")?.({
      data: { json: () => data, text: () => JSON.stringify(data) },
      waitUntil(value: Promise<unknown>) { pending = value; },
    });
    await pending;
  }

  async function click(url: string) {
    let pending: Promise<unknown> | undefined;
    listeners.get("notificationclick")?.({
      notification: { close: vi.fn(), data: { url } },
      waitUntil(value: Promise<unknown>) { pending = value; },
    });
    await pending;
  }

  return { push, click, showNotification, openWindow };
}

function client(url: string, visibilityState: "visible" | "hidden" = "visible"): Client {
  return {
    url,
    visibilityState,
    focus: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn().mockResolvedValue(undefined),
    postMessage: vi.fn(),
  };
}

const reply = {
  title: "Atlas VIP — Suporte respondeu",
  body: "Nova resposta",
  kind: "reply",
  url: "/painel?suporte=1",
  tag: "atlas-support-message-a",
  messageId: "message-a",
};

describe("notificações do chat de suporte", () => {
  it("não mostra notificação quando a conversa já está aberta e visível", async () => {
    const harness = workerHarness([client("https://atlas.test/painel?suporte=1")]);
    await harness.push(reply);
    expect(harness.showNotification).not.toHaveBeenCalled();
  });

  it("mostra uma única notificação em segundo plano, mesmo com push repetido", async () => {
    const harness = workerHarness([client("https://atlas.test/painel?suporte=1", "hidden")]);
    await harness.push(reply);
    await harness.push(reply);
    expect(harness.showNotification).toHaveBeenCalledTimes(1);
    expect(harness.showNotification).toHaveBeenCalledWith(
      reply.title,
      expect.objectContaining({ body: reply.body, tag: reply.tag }),
    );
  });

  it("ao clicar, reutiliza o painel aberto e entra direto no suporte", async () => {
    const openClient = client("https://atlas.test/painel");
    const harness = workerHarness([openClient]);
    await harness.click(reply.url);
    expect(openClient.postMessage).toHaveBeenCalledWith({ type: "ATLAS_OPEN_URL", url: reply.url });
    expect(openClient.focus).toHaveBeenCalledOnce();
    expect(openClient.navigate).not.toHaveBeenCalled();
    expect(harness.openWindow).not.toHaveBeenCalled();
  });

  it("abre a conversa administrativa correspondente quando não há tela aberta", async () => {
    const harness = workerHarness();
    const url = "/admin?tab=support&thread=thread-a";
    await harness.click(url);
    expect(harness.openWindow).toHaveBeenCalledWith(url);
  });
});
