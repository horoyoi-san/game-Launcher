import gameCatalog from "../../../game.json";

export const launcherGames = [
    { id: "PetitPlanet", name: "Petit Planet", route: "/hyg", icon: "/icon/hyg.png" },
    { id: "Nexusanima", name: "Honkai: Nexus Anima", route: "/abc", icon: "/icon/abc.png" },
    { id: "Zenless", name: "Zenless Zone Zero", route: "/nap", icon: "/icon/nap.png" },
    { id: "StarRail", name: "Honkai: Star Rail", route: "/hkrpg", icon: "/icon/hkrpg.png" },
    { id: "Genshin", name: "Genshin Impact", route: "/hk4e", icon: "/icon/hk4e.png" },
    { id: "Impact3rd", name: "Honkai Impact 3rd", route: "/bh3", icon: "/icon/bh3.png" },
    { id: "TheWeavers", name: "The Weavers", route: "/kl", icon: "/icon/kl.png" },
] as const;

export default gameCatalog;