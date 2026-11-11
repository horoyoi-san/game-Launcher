import { FSService } from "@bindings/SilverWolf999-launcher/internal/fs-service";

type GameRegion = "OSREL" | "CNREL" | "OSBETA" | "CNBETA";

type LauncherGame = {
    id: string;
    name: string;
    route: string;
    icon: string;
    apiGameIds: Partial<Record<GameRegion, readonly string[]>>;
};

export const launcherGames: readonly LauncherGame[] = [
    {
        id: "PetitPlanet",
        name: "Petit Planet",
        route: "/hyg",
        icon: "/icon/hyg.png",
        apiGameIds: {
            OSREL: ["viiywh5G2H", "a26PNg1Mgk"],
            CNREL: ["ERYDdvf0w8"],
            OSBETA: ["679gqJWz4L"],
            CNBETA: ["0fijU7nET7", "Dg5IUTLSzd"],
        },
    },
    {
        id: "Nexusanima",
        name: "Honkai: Nexus Anima",
        route: "/abc",
        icon: "/icon/abc.png",
        apiGameIds: {
            OSREL: ["yneO4yGc4x"],
            CNREL: ["m8TGERqknS"],
            OSBETA: ["4qvmDrMwKS", "IWISpEcDbC"],
            CNBETA: ["j7rlly0oYR", "lgyIM35mz8"],
        },
    },
    {
        id: "Zenless",
        name: "Zenless Zone Zero",
        route: "/nap",
        icon: "/icon/nap.png",
        apiGameIds: { OSREL: ["U5hbdsT9W7"], CNREL: ["x6znKlJ0xK"] },
    },
    {
        id: "StarRail",
        name: "Honkai: Star Rail",
        route: "/hkrpg",
        icon: "/icon/hkrpg.png",
        apiGameIds: { OSREL: ["4ziysqXOQ8"], CNREL: ["64kMb5iAWu"] },
    },
    {
        id: "Genshin",
        name: "Genshin Impact",
        route: "/hk4e",
        icon: "/icon/hk4e.png",
        apiGameIds: { OSREL: ["gopR6Cufr3"], CNREL: ["1Z8W5NHUQb"] },
    },
    {
        id: "Impact3rd",
        name: "Honkai Impact 3rd",
        route: "/bh3",
        icon: "/icon/bh3.png",
        apiGameIds: {
            OSREL: ["5TIVvvcwtM", "g0mMIvshDb", "uxB4MC7nzC", "bxPTXSET5t", "wkE5P5WsIf"],
            CNREL: ["osvnlOc0S8"],
        },
    },
    {
        id: "TheWeavers",
        name: "The Weavers",
        route: "/kl",
        icon: "/icon/kl.png",
        apiGameIds: { 
            CNBETA: ["pkMBmK7jxJ"], 
            OSBETA: ["SIAMAGOONER"] },
    },
    {
        id: "Varsapura",
        name: "Varsapura",
        route: "/varsapura",
        icon: "/icon/varsapura.png",
        apiGameIds: { 
            CNBETA: ["SIAMAGOONER"], 
            OSBETA: ["SIAMAGOONER"] },
    },
];

export type LauncherGameArtwork = {
    backgroundUrl?: string;
    thumbnailUrl?: string;
};

const gameMetadataRegions: Record<GameRegion, { launcherIds: readonly string[] }> = {
    OSREL: {
        launcherIds: ["VYTpXlbWo8", "dYgxEMpG3U"],
    },
    CNREL: {
        launcherIds: ["jGHBHlcOq1"],
    },
    OSBETA: {
        launcherIds: ["9HDza24TWA", "95ODRGH3xC", "KAGKS3zS99"],
    },
    CNBETA: {
        launcherIds: ["GcFHm7rte6", "kwykHprMm9", "TC4836G73s", "WBjNy0hOrG", "TATUNXLuIq"],
    },
};

function getGameMetadataRequests() {
    const requests: Array<{ region: GameRegion; launcherId: string; gameIds: string[] }> = [];

    for (const [region, config] of Object.entries(gameMetadataRegions) as [GameRegion, (typeof gameMetadataRegions)[GameRegion]][]) {
        const gameIds = launcherGames.flatMap((game) => game.apiGameIds[region] ?? []);
        if (gameIds.length === 0) continue;

        for (const launcherId of config.launcherIds) {
            requests.push({ region, launcherId, gameIds });
        }
    }

    return requests;
}

const gameMetadataRequests = getGameMetadataRequests();

export async function fetchLauncherGameArtwork(signal?: AbortSignal) {
    const results = await Promise.allSettled(
        gameMetadataRequests.map(({ region, launcherId, gameIds }) =>
            FSService.GetGameArtwork(gameIds, region, launcherId),
        ),
    );
    if (signal?.aborted) {
        throw new DOMException("Game artwork request was cancelled", "AbortError");
    }
    const artwork: Record<string, LauncherGameArtwork> = {};
    let successfulEndpoints = 0;

    for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (result.status === "rejected") continue;
        successfulEndpoints += 1;
        const region = gameMetadataRequests[index].region;

        for (const metadata of result.value) {
            const game = launcherGames.find((item) => item.apiGameIds[region]?.includes(metadata.gameId));
            if (!game) continue;

            const currentArtwork = artwork[game.id] ?? {};
            artwork[game.id] = {
                backgroundUrl: currentArtwork.backgroundUrl ?? (metadata.backgroundUrl || undefined),
                thumbnailUrl: currentArtwork.thumbnailUrl ?? (metadata.thumbnailUrl || undefined),
            };
        }
    }

    if (successfulEndpoints === 0) {
        throw new Error("Could not load game artwork from any HoYoverse API.");
    }

    return {
        artwork,
        hasUnavailableEndpoints: successfulEndpoints < gameMetadataRequests.length,
    };
}
