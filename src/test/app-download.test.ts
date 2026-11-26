import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DOWNLOAD_FILE_NAME,
  deliverManagedDownload,
  isCurrentDownloadReady,
  isValidDownloadTextFile,
} from "@/lib/app-download";

describe("arquivo gerenciado pelo ADM", () => {
  it("aceita somente TXT não vazio de até 10 MB", () => {
    expect(isValidDownloadTextFile({ name: "atlas.txt", size: 120 })).toBe(true);
    expect(isValidDownloadTextFile({ name: "ATLAS.TXT", size: 10 * 1024 * 1024 })).toBe(true);
    expect(isValidDownloadTextFile({ name: "atlas.zip", size: 120 })).toBe(false);
    expect(isValidDownloadTextFile({ name: "vazio.txt", size: 0 })).toBe(false);
    expect(isValidDownloadTextFile({ name: "grande.txt", size: 10 * 1024 * 1024 + 1 })).toBe(false);
  });

  it("exige novo download quando o ADM substitui o arquivo", () => {
    expect(isCurrentDownloadReady("injection/antigo.txt", "injection/atual.txt")).toBe(false);
    expect(isCurrentDownloadReady("injection/atual.txt", "injection/atual.txt")).toBe(true);
    expect(isCurrentDownloadReady("1", "injection/atual.txt")).toBe(false);
  });
});

describe("download sem prender o usuário na visualização", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("usa a folha de arquivos no iPhone e não abre outra página", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      share,
      canShare: vi.fn().mockReturnValue(true),
    });
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    const result = await deliverManagedDownload(new Blob(["ATLAS"], { type: "text/plain" }), DEFAULT_DOWNLOAD_FILE_NAME);

    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });

  it("não fecha nem marca como baixado quando o compartilhamento é cancelado", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new DOMException("Cancelado", "AbortError")),
      canShare: vi.fn().mockReturnValue(true),
    });
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);

    await expect(deliverManagedDownload(new Blob(["ATLAS"]), "atlas.txt")).resolves.toBe("cancelled");
  });

  it("usa um Blob com nome de download no navegador comum", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.fn().mockReturnValue("blob:atlas-download");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);

    await expect(deliverManagedDownload(new Blob(["ATLAS"]), "atlas.txt")).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
  });
});
