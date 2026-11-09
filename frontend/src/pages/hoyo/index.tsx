import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, ExternalLink, LoaderCircle, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { FSService } from "@bindings/sunbringer-launcher/internal/fs-service";
import { HoyoService } from "@bindings/sunbringer-launcher/internal/hoyo-service";
import discRecommendations from "./disc-recommendations.json";

type CatalogItem = {
    id: number;
    name: string;
    imageId: string;
    imagePath: string;
    rank: number;
    specialty?: number;
    element?: number;
    twoPieceEffect?: string;
    fourPieceEffect?: string;
    potentialIds?: number[];
    skinIds?: number[];
};

type HoyoCatalog = {
    characters: CatalogItem[];
    weapons: CatalogItem[];
    disks: CatalogItem[];
    skinDataError?: string;
};

type DiskConfig = {
    setId?: number;
    rank: number;
    slot: number;
    mainStat: number;
    subStatIds: number[];
    subStatRolls: number[];
    allowOverLimitRolls: boolean;
};

type SavedDiskSet = {
    id: string;
    name: string;
    setId: number;
    disks: DiskConfig[];
    targetAgentId?: number;
};

type SaveInventoryItem = {
    uid: number;
    id: number;
    level: number;
    rank: number;
    refinement?: number;
    slot?: number;
    setId?: number;
    equippedToAgentIds?: number[];
};

type SaveInventory = {
    characters: number[];
    weapons: SaveInventoryItem[];
    disks: SaveInventoryItem[];
};

type DiscRecommendation = {
    characterName: string;
    role: string;
    fourPieceSetId: number;
    twoPieceSetId: number;
    alternativeTwoPieceSetIds: number[];
    mainStats: Record<number, number>;
    subStats: number[];
    note: string;
    guideUpdated: string;
    source: string;
};

type EditableDiscRecommendation = Pick<
    DiscRecommendation,
    "fourPieceSetId" | "twoPieceSetId" | "mainStats" | "subStats"
>;

type Category = "disks" | "characters" | "weapons";

type ConfirmationDialog = {
    eyebrow: string;
    title: string;
    description: string;
    details: string[];
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
};

const SAVED_DISK_SETS_KEY = "hoyoSavedDiskSets";
const DISC_RECOMMENDATION_OVERRIDES_KEY = "hoyoDiscRecommendationOverrides";
const RANK_FILTERS = [
    { rank: null, label: "ALL" },
    { rank: 4, label: "S" },
    { rank: 3, label: "A" },
    { rank: 2, label: "B" },
] as const;
const TABS: { id: Category; label: string; caption: string }[] = [
    { id: "disks", label: "Drive Discs", caption: "Create a custom disc" },
    { id: "characters", label: "Agents", caption: "Tune an agent's growth" },
    { id: "weapons", label: "W-Engines", caption: "Add and refine an engine" },
];
const SAVE_MANAGER_TABS = [
    { id: "disks", label: "Drive Discs" },
    { id: "weapons", label: "W-Engines" },
    { id: "characters", label: "Agents" },
    { id: "loadouts", label: "Saved Sets" },
] as const;

const STATS = [
    { id: 11103, name: "HP" },
    { id: 11102, name: "% HP" },
    { id: 12103, name: "ATK" },
    { id: 12102, name: "% ATK" },
    { id: 13103, name: "DEF" },
    { id: 13102, name: "% DEF" },
    { id: 23203, name: "PEN" },
    { id: 23103, name: "% PEN" },
    { id: 31402, name: "Anomaly Mastery" },
    { id: 31203, name: "Anomaly Proficiency" },
    { id: 21103, name: "CRIT DMG" },
    { id: 20103, name: "CRIT Rate" },
    { id: 30502, name: "Energy Regen" },
    { id: 12202, name: "Impact" },
    { id: 31803, name: "Electric DMG" },
    { id: 31903, name: "Ether DMG" },
    { id: 31603, name: "Fire DMG" },
    { id: 31703, name: "Ice DMG" },
    { id: 31503, name: "Physical DMG" },
    { id: 32303, name: "Wind DMG" },
];

const SUBSTAT_IDS = [11103, 11102, 12103, 12102, 13103, 13102, 23203, 31203, 21103, 20103];
const DISC_RECOMMENDATIONS: Record<number, DiscRecommendation> = discRecommendations;
const MAIN_STATS_BY_SLOT: Record<number, number[]> = {
    1: [11103],
    2: [12103],
    3: [13103],
    4: [12102, 13102, 11102, 20103, 21103, 31203],
    5: [12102, 13102, 11102, 23103, 31503, 31603, 31703, 31803, 31903, 32303],
    6: [12102, 13102, 11102, 12202, 31402, 30502],
};

const SKILLS = [
    { id: 0, name: "Basic Attack", max: 12 },
    { id: 2, name: "Dodge", max: 12 },
    { id: 6, name: "Assist", max: 12 },
    { id: 1, name: "Special Attack", max: 12 },
    { id: 3, name: "Chain Attack", max: 12 },
    { id: 5, name: "Core Skill", max: 7 },
    { id: 4, name: "Unique Skill", max: 12 },
];

const getStatName = (id: number) => STATS.find((stat) => stat.id === id)?.name ?? "Select stat";
const getDiscRecommendation = (character: CatalogItem): DiscRecommendation | null =>
    DISC_RECOMMENDATIONS[character.id] ?? null;
const isEditableDiscRecommendation = (value: unknown): value is EditableDiscRecommendation => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const recommendation = value as Partial<EditableDiscRecommendation>;
    const mainStats = recommendation.mainStats;
    const subStats = recommendation.subStats;
    if (typeof recommendation.fourPieceSetId !== "number" ||
        typeof recommendation.twoPieceSetId !== "number" ||
        !mainStats || typeof mainStats !== "object" || Array.isArray(mainStats) ||
        !Array.isArray(subStats) || subStats.length !== 5) return false;
    return Number.isInteger(recommendation.fourPieceSetId) && recommendation.fourPieceSetId > 0 &&
        Number.isInteger(recommendation.twoPieceSetId) && recommendation.twoPieceSetId > 0 &&
        [4, 5, 6].every((slot) => MAIN_STATS_BY_SLOT[slot].includes(mainStats[slot])) &&
        subStats.every((statId) => statId === 0 || SUBSTAT_IDS.includes(statId)) &&
        new Set(subStats.filter((statId) => statId !== 0)).size === subStats.filter((statId) => statId !== 0).length;
};
const normalizeRecommendedSubStats = (subStats: number[]) => {
    const seen = new Set<number>();
    return Array.from({ length: 5 }, (_, index) => {
        const statId = subStats[index] ?? 0;
        if (statId === 0) return 0;
        if (!SUBSTAT_IDS.includes(statId) || seen.has(statId)) return 0;
        seen.add(statId);
        return statId;
    });
};
const getMaxDiskRolls = (rank: number) => rank + 1;
const randomizeSubStatRolls = (count: number, minRolls: number, maxRolls: number) => {
    const rolls = Array.from({ length: count }, () => 0);
    let remainingRolls = Math.floor(Math.random() * (maxRolls - minRolls + 1)) + minRolls;

    while (remainingRolls > 0) {
        const eligible = rolls
            .map((value, index) => value < 14 ? index : -1)
            .filter((index) => index >= 0);
        if (eligible.length === 0) break;
        const index = eligible[Math.floor(Math.random() * eligible.length)];
        rolls[index] += 1;
        remainingRolls -= 1;
    }

    return rolls;
};
const buildRecommendedDisks = (recommendation: DiscRecommendation): DiskConfig[] =>
    [1, 2, 3, 4, 5, 6].map((slot) => {
        const mainStat = slot < 4
            ? slot === 1 ? 11103 : slot === 2 ? 12103 : 13103
            : recommendation.mainStats[slot];
        const subStatIds = [...new Set(recommendation.subStats.filter((statId) =>
            statId !== 0 && statId !== mainStat && SUBSTAT_IDS.includes(statId),
        ))].slice(0, 4);
        const randomCandidates = SUBSTAT_IDS.filter((statId) => statId !== mainStat && !subStatIds.includes(statId));
        while (subStatIds.length < 4 && randomCandidates.length > 0) {
            const randomIndex = Math.floor(Math.random() * randomCandidates.length);
            subStatIds.push(randomCandidates.splice(randomIndex, 1)[0]);
        }
        return {
            setId: slot <= 4 ? recommendation.fourPieceSetId : recommendation.twoPieceSetId,
            rank: 4,
            slot,
            mainStat,
            subStatIds,
            subStatRolls: randomizeSubStatRolls(subStatIds.length, 2, getMaxDiskRolls(4)),
            allowOverLimitRolls: false,
        };
    });
const getCatalogRank = (item: CatalogItem, category: Category) => {
    const rank = Number(item.rank);
    if (Number.isInteger(rank) && rank >= 2 && rank <= 4) return rank;
    return category === "weapons" ? Math.floor(item.id / 1000) - 10 : 0;
};
const isDiskConfig = (value: unknown): value is DiskConfig => {
    if (!value || typeof value !== "object") return false;
    const config = value as DiskConfig;
    return (config.setId === undefined || Number.isInteger(config.setId)) &&
        Number.isInteger(config.rank) && Number.isInteger(config.slot) &&
        Number.isInteger(config.mainStat) && Array.isArray(config.subStatIds) &&
        config.subStatIds.length === 4 && config.subStatIds.every(Number.isInteger) &&
        Array.isArray(config.subStatRolls) && config.subStatRolls.length === 4 &&
        config.subStatRolls.every(Number.isInteger) && typeof config.allowOverLimitRolls === "boolean";
};
const isSavedDiskSet = (value: unknown): value is SavedDiskSet => {
    if (!value || typeof value !== "object") return false;
    const savedSet = value as SavedDiskSet;
    if (typeof savedSet.id !== "string" || typeof savedSet.name !== "string" ||
        !Number.isInteger(savedSet.setId) || !Array.isArray(savedSet.disks) ||
        (savedSet.targetAgentId !== undefined && (!Number.isInteger(savedSet.targetAgentId) || savedSet.targetAgentId <= 0)) ||
        savedSet.disks.length < 1 || savedSet.disks.length > 6 ||
        !savedSet.disks.every(isDiskConfig)) return false;
    return new Set(savedSet.disks.map((disk) => disk.slot)).size === savedSet.disks.length &&
        savedSet.disks.every((disk) => disk.slot >= 1 && disk.slot <= 6);
};
const getDiskConfigError = (config: DiskConfig): string | null => {
    if (config.rank < 2 || config.rank > 4 || config.slot < 1 || config.slot > 6) return "Invalid Drive Disc rank or slot.";
    if (!(MAIN_STATS_BY_SLOT[config.slot] ?? []).includes(config.mainStat)) return `Main stat is invalid for slot ${config.slot}.`;
    if (config.subStatIds.some((id) => !SUBSTAT_IDS.includes(id)) ||
        new Set([config.mainStat, ...config.subStatIds]).size !== 5) return `Slot ${config.slot} must have four different valid substats.`;
    if (config.subStatRolls.some((rolls) => rolls < 0 || rolls > 14)) return `Slot ${config.slot} roll counts must be between 0 and 14.`;
    const rollLimit = config.allowOverLimitRolls ? 56 : getMaxDiskRolls(config.rank);
    if (config.subStatRolls.reduce((sum, rolls) => sum + rolls, 0) > rollLimit) {
        return `Slot ${config.slot} exceeds its ${rollLimit}-roll limit.`;
    }
    return null;
};
const getPlayerUid = () => {
    const savedUidText = localStorage.getItem("hoyoPlayerUid");
    if (savedUidText === "1") return "67";
    const savedUid = Number(savedUidText);
    return Number.isSafeInteger(savedUid) && savedUid > 0 && savedUid <= 0xffffffff ? String(savedUid) : "67";
};

function CatalogCard({
    item,
    category,
    selected,
    onSelect,
}: {
    item: CatalogItem;
    category: Category;
    selected: boolean;
    onSelect: () => void;
}) {
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => setImageFailed(false), [item.imagePath]);

    const rarity = getCatalogRank(item, category);
    const rarityLabel = rarity === 4 ? "S-RANK" : rarity === 3 ? "A-RANK" : rarity === 2 ? "B-RANK" : "";

    return (
        <button
            type="button"
            className={`hoyo-item-card ${selected ? "is-selected" : ""} ${rarityLabel ? `rarity-${rarity}` : ""}`}
            onClick={onSelect}
            aria-pressed={selected}
            title={item.name}
        >
            <span className="hoyo-item-card__art">
                {item.imagePath && !imageFailed ? (
                    <img src={item.imagePath} alt="" loading="lazy" onError={() => setImageFailed(true)} />
                ) : (
                    <span className="hoyo-item-card__fallback">
                        <span aria-hidden="true">{category === "disks" ? <Sparkles size={24} /> : item.name.slice(0, 1)}</span>
                        <small>Local image missing</small>
                    </span>
                )}
                {rarityLabel && <span className="hoyo-item-card__rarity">{rarityLabel}</span>}
            </span>
            <span className="hoyo-item-card__name">{item.name}</span>
            <span className="hoyo-item-card__id">ID {item.id}{item.imageId && ` · IMG ${item.imageId}`}</span>
        </button>
    );
}

function NumberField({
    label,
    value,
    min,
    max,
    onChange,
    optional = false,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    optional?: boolean;
}) {
    return (
        <label className="hoyo-field">
            <span>{label}{optional && <small>OPTIONAL</small>}</span>
            <input
                type="number"
                min={min}
                max={max}
                value={value || ""}
                placeholder={optional ? "Leave unchanged" : `${min} - ${max}`}
                onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
            />
        </label>
    );
}

function DiskSetPicker({
    label,
    disks,
    selectedSetId,
    onChange,
}: {
    label: string;
    disks: CatalogItem[];
    selectedSetId: number;
    onChange: (setId: number) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedDisk = disks.find((disk) => disk.id === selectedSetId);
    const listId = `disk-set-options-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    return (
        <div className="hoyo-field hoyo-disc-set-picker">
            <span>{label}</span>
            <button
                type="button"
                className="hoyo-disc-set-picker__trigger"
                aria-expanded={isOpen}
                aria-controls={listId}
                onClick={() => setIsOpen((open) => !open)}
            >
                {selectedDisk?.imagePath ? (
                    <img src={selectedDisk.imagePath} alt="" />
                ) : (
                    <Sparkles size={18} aria-hidden="true" />
                )}
                <span>{selectedDisk?.name ?? `Drive Disc ${selectedSetId}`}</span>
                <b>{isOpen ? "−" : "+"}</b>
            </button>
            {isOpen && (
                <div className="hoyo-disc-set-picker__options" id={listId}>
                    {disks.map((disk) => (
                        <button
                            type="button"
                            key={disk.id}
                            className={`hoyo-disc-set-picker__option ${disk.id === selectedSetId ? "is-selected" : ""}`}
                            aria-pressed={disk.id === selectedSetId}
                            onClick={() => {
                                onChange(disk.id);
                                setIsOpen(false);
                            }}
                        >
                            {disk.imagePath ? (
                                <img src={disk.imagePath} alt="" loading="lazy" />
                            ) : (
                                <Sparkles size={18} aria-hidden="true" />
                            )}
                            <span>
                                <b>{disk.name}</b>
                                <small>{disk.twoPieceEffect || "Drive Disc set"}</small>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function HoyoPage() {
    const [catalog, setCatalog] = useState<HoyoCatalog | null>(null);
    const [catalogError, setCatalogError] = useState("");
    const [category, setCategory] = useState<Category>("disks");
    const [activePage, setActivePage] = useState<"workshop" | "manage">("workshop");
    const [saveManagerSection, setSaveManagerSection] = useState<(typeof SAVE_MANAGER_TABS)[number]["id"]>("disks");
    const [saveCharacterId, setSaveCharacterId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [rankFilter, setRankFilter] = useState<number | null>(null);
    const [playerUid, setPlayerUid] = useState(getPlayerUid);
    const [selectedDiskId, setSelectedDiskId] = useState<number | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
    const [selectedWeaponId, setSelectedWeaponId] = useState<number | null>(null);
    const [diskSlot, setDiskSlot] = useState(1);
    const [diskRank, setDiskRank] = useState(4);
    const [mainStat, setMainStat] = useState(11103);
    const [subStatIds, setSubStatIds] = useState([0, 0, 0, 0]);
    const [subStatRolls, setSubStatRolls] = useState([0, 0, 0, 0]);
    const [allowOverLimitRolls, setAllowOverLimitRolls] = useState(false);
    const [draftDiskSetId, setDraftDiskSetId] = useState<number | null>(null);
    const [draftDiskSlots, setDraftDiskSlots] = useState<DiskConfig[]>([]);
    const [draftSavedSetId, setDraftSavedSetId] = useState<string | null>(null);
    const [diskSetName, setDiskSetName] = useState("");
    const [savedDiskSets, setSavedDiskSets] = useState<SavedDiskSet[]>([]);
    const [editingSavedDisks, setEditingSavedDisks] = useState<Record<string, DiskConfig>>({});
    const [discRecommendationOverrides, setDiscRecommendationOverrides] = useState<Record<number, EditableDiscRecommendation>>({});
    const [discRecommendationOverridesLoaded, setDiscRecommendationOverridesLoaded] = useState(false);
    const [agentLevel, setAgentLevel] = useState(0);
    const [skillLevels, setSkillLevels] = useState([0, 0, 0, 0, 0, 0, 0]);
    const [mindscape, setMindscape] = useState(-1);
    const [potentialLevel, setPotentialLevel] = useState(-1);
    const [avatarSkinID, setAvatarSkinID] = useState(0);
    const [weaponLevel, setWeaponLevel] = useState(60);
    const [refinement, setRefinement] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExportingDiscRecommendations, setIsExportingDiscRecommendations] = useState(false);
    const [saveInventory, setSaveInventory] = useState<SaveInventory | null>(null);
    const [loadedInventoryUid, setLoadedInventoryUid] = useState<number | null>(null);
    const [saveInventoryError, setSaveInventoryError] = useState("");
    const [isLoadingSaveInventory, setIsLoadingSaveInventory] = useState(false);
    const [inventoryRefreshId, setInventoryRefreshId] = useState(0);
    const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialog | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(SAVED_DISK_SETS_KEY);
            if (!stored) return;
            const parsed: unknown = JSON.parse(stored);
            if (!Array.isArray(parsed) || !parsed.every(isSavedDiskSet)) {
                throw new Error("Saved Drive Disc sets have an invalid format.");
            }
            setSavedDiskSets(parsed);
        } catch (error: unknown) {
            toast.error(`Could not load saved Drive Disc sets: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, []);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(DISC_RECOMMENDATION_OVERRIDES_KEY);
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                    throw new Error("Drive Disc recommendation settings have an invalid format.");
                }
                const overrides: Record<number, EditableDiscRecommendation> = {};
                for (const [characterId, value] of Object.entries(parsed)) {
                    if (!/^\d+$/.test(characterId) || !isEditableDiscRecommendation(value)) {
                        throw new Error(`Drive Disc recommendation settings for Agent ${characterId} are invalid.`);
                    }
                    overrides[Number(characterId)] = value;
                }
                setDiscRecommendationOverrides(overrides);
            }
        } catch (error: unknown) {
            toast.error(`Could not load custom Drive Disc recommendations: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setDiscRecommendationOverridesLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!discRecommendationOverridesLoaded) return;
        try {
            localStorage.setItem(DISC_RECOMMENDATION_OVERRIDES_KEY, JSON.stringify(discRecommendationOverrides));
        } catch (error: unknown) {
            toast.error(`Could not save custom Drive Disc recommendations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [discRecommendationOverrides, discRecommendationOverridesLoaded]);

    const loadCatalog = async () => {
        setCatalogError("");
        try {
            const [result, error] = await HoyoService.GetCatalog();
            if (error) {
                setCatalog(null);
                setCatalogError(error);
                return;
            }
            setCatalog(result);
        } catch (error: unknown) {
            setCatalog(null);
            setCatalogError(error instanceof Error ? error.message : String(error));
        }
    };

    useEffect(() => {
        let mounted = true;
        HoyoService.GetCatalog()
            .then(([result, error]) => {
                if (!mounted) return;
                if (error) {
                    setCatalogError(error);
                    return;
                }
                setCatalog(result);
            })
            .catch((error: unknown) => {
                if (mounted) setCatalogError(error instanceof Error ? error.message : String(error));
            });
        return () => {
            mounted = false;
        };
    }, []);

    const currentItems = useMemo(() => {
        if (!catalog) return [];
        return category === "disks" ? catalog.disks : category === "characters" ? catalog.characters : catalog.weapons;
    }, [catalog, category]);

    const filteredItems = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        return currentItems.filter((item) => {
            const matchesSearch = !normalized || item.name.toLowerCase().includes(normalized) || String(item.id).includes(normalized);
            const matchesRank = rankFilter === null || getCatalogRank(item, category) === rankFilter;
            return matchesSearch && matchesRank;
        });
    }, [category, currentItems, rankFilter, search]);
    const rankCounts = useMemo(() => currentItems.reduce<Record<number, number>>((counts, item) => {
        const rank = getCatalogRank(item, category);
        counts[rank] = (counts[rank] ?? 0) + 1;
        return counts;
    }, {}), [category, currentItems]);

    const mainStatOptions = MAIN_STATS_BY_SLOT[diskSlot] ?? [];
    const totalRolls = subStatRolls.reduce((sum, roll) => sum + roll, 0);
    const maxDiskRolls = getMaxDiskRolls(diskRank);
    const rollLimit = allowOverLimitRolls ? 56 : maxDiskRolls;
    const selectedItemId = category === "disks" ? selectedDiskId : category === "characters" ? selectedAgentId : selectedWeaponId;
    const selectedItem = currentItems.find((item) => item.id === selectedItemId);
    const selectedCharacter = catalog?.characters.find((item) => item.id === selectedAgentId);
    const baseAgentRecommendation = selectedCharacter ? getDiscRecommendation(selectedCharacter) : null;
    const selectedAgentOverride = selectedCharacter ? discRecommendationOverrides[selectedCharacter.id] : undefined;
    const selectedAgentRecommendation = baseAgentRecommendation
        ? {
            ...baseAgentRecommendation,
            ...selectedAgentOverride,
            mainStats: selectedAgentOverride?.mainStats ?? baseAgentRecommendation.mainStats,
            subStats: selectedAgentOverride?.subStats ?? baseAgentRecommendation.subStats,
        }
        : null;
    const updateSelectedAgentRecommendation = (patch: Partial<EditableDiscRecommendation>) => {
        if (!selectedCharacter || !selectedAgentRecommendation) return;
        const updated: EditableDiscRecommendation = {
            fourPieceSetId: selectedAgentRecommendation.fourPieceSetId,
            twoPieceSetId: selectedAgentRecommendation.twoPieceSetId,
            mainStats: selectedAgentRecommendation.mainStats,
            subStats: selectedAgentRecommendation.subStats,
            ...patch,
        };
        updated.subStats = normalizeRecommendedSubStats(updated.subStats);
        setDiscRecommendationOverrides((current) => ({ ...current, [selectedCharacter.id]: updated }));
    };
    const resetSelectedAgentRecommendation = () => {
        if (!selectedCharacter) return;
        setDiscRecommendationOverrides((current) => {
            const updated = { ...current };
            delete updated[selectedCharacter.id];
            return updated;
        });
    };
    const exportDiscRecommendationsForBuild = async () => {
        setIsExportingDiscRecommendations(true);
        try {
            const recommendations: Record<number, DiscRecommendation> = { ...DISC_RECOMMENDATIONS };
            for (const [characterId, override] of Object.entries(discRecommendationOverrides)) {
                const current = recommendations[Number(characterId)];
                if (!current) {
                    throw new Error(`No default Drive Disc recommendation exists for Agent ${characterId}.`);
                }
                recommendations[Number(characterId)] = {
                    ...current,
                    ...override,
                    mainStats: override.mainStats,
                    subStats: override.subStats,
                };
            }

            const filePath = await FSService.ExportDiscRecommendations(
                `${JSON.stringify(recommendations, null, 2)}\n`,
            );
            if (filePath) {
                toast.success(`Saved build recommendations: ${filePath}`);
            }
        } catch (error: unknown) {
            toast.error(`Could not save build recommendations: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsExportingDiscRecommendations(false);
        }
    };
    const potentialIDs = selectedCharacter?.potentialIds ?? [];
    const skinIDs = selectedCharacter?.skinIds ?? [];
    const activeDraftSet = savedDiskSets.find((set) => set.id === draftSavedSetId);
    const currentDraftSlots = activeDraftSet?.disks ?? draftDiskSlots;
    const draftSlotCount = currentDraftSlots.length;
    const activeDraftSlot = currentDraftSlots.find((disk) => disk.slot === diskSlot);
    const uid = Number(playerUid);
    const validUid = Number.isSafeInteger(uid) && uid > 0 && uid <= 0xffffffff;
    const currentSaveInventory = loadedInventoryUid === uid ? saveInventory : null;
    const selectedSavedCharacterId = currentSaveInventory?.characters.includes(saveCharacterId ?? -1)
        ? saveCharacterId
        : currentSaveInventory?.characters[0] ?? null;

    useEffect(() => {
        if (!validUid) {
            setSaveInventory(null);
            setLoadedInventoryUid(null);
            setSaveInventoryError("");
            return;
        }
        let mounted = true;
        setSaveInventory(null);
        setLoadedInventoryUid(null);
        setIsLoadingSaveInventory(true);
        setSaveInventoryError("");
        HoyoService.GetSaveInventory(uid)
            .then(([inventory, error]) => {
                if (!mounted) return;
                if (error) {
                    setSaveInventory(null);
                    setSaveInventoryError(error);
                    return;
                }
                setSaveInventory(inventory);
                setLoadedInventoryUid(uid);
            })
            .catch((error: unknown) => {
                if (!mounted) return;
                setSaveInventory(null);
                setSaveInventoryError(error instanceof Error ? error.message : String(error));
            })
            .finally(() => {
                if (mounted) setIsLoadingSaveInventory(false);
            });
        return () => {
            mounted = false;
        };
    }, [inventoryRefreshId, uid, validUid]);

    useEffect(() => {
        if (!confirmationDialog) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setConfirmationDialog(null);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [confirmationDialog]);

    const submit = async (action: () => Promise<[boolean, string]>, successMessage: string): Promise<boolean> => {
        if (!validUid) {
            toast.error("Enter a valid player UID between 1 and 4,294,967,295.");
            return false;
        }
        setIsSubmitting(true);
        try {
            localStorage.setItem("hoyoPlayerUid", String(uid));
            const [ok, message] = await action();
            if (!ok) {
                toast.error(message || "The Remielle control request failed.");
                return false;
            }
            toast.success(message || successMessage);
            return true;
        } catch (error: unknown) {
            toast.error(`Hoyo request failed: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitAndRefreshInventory = async (
        action: () => Promise<[boolean, string]>,
        successMessage: string,
    ) => {
        const succeeded = await submit(action, successMessage);
        if (succeeded) setInventoryRefreshId((value) => value + 1);
        return succeeded;
    };

    const createDisk = (stats = subStatIds, rolls = subStatRolls) => {
        if (!selectedDiskId) {
            toast.error("Select a Drive Disc set first.");
            return;
        }
        const config: DiskConfig = {
            setId: selectedDiskId,
            rank: diskRank,
            slot: diskSlot,
            mainStat,
            subStatIds: stats,
            subStatRolls: rolls,
            allowOverLimitRolls,
        };
        const validationError = getDiskConfigError(config);
        if (validationError) {
            toast.error(validationError);
            return;
        }
        void submit(
            () => HoyoService.CreateDisk(uid, selectedDiskId, diskRank, diskSlot, mainStat, stats, rolls),
            "Drive Disc created.",
        );
    };

    const selectDiskSlot = (slot: number) => {
        setDiskSlot(slot);
        const savedSlot = currentDraftSlots.find((disk) => disk.slot === slot);
        if (savedSlot) {
            setSelectedDiskId(savedSlot.setId ?? activeDraftSet?.setId ?? draftDiskSetId ?? selectedDiskId);
            setDiskRank(savedSlot.rank);
            setMainStat(savedSlot.mainStat);
            setSubStatIds(savedSlot.subStatIds);
            setSubStatRolls(savedSlot.subStatRolls);
            setAllowOverLimitRolls(savedSlot.allowOverLimitRolls);
            return;
        }
        setMainStat(MAIN_STATS_BY_SLOT[slot][0]);
        setSubStatIds([0, 0, 0, 0]);
        setSubStatRolls([0, 0, 0, 0]);
    };

    const saveCurrentDiskSlot = () => {
        if (!selectedDiskId) {
            toast.error("Select a Drive Disc set first.");
            return;
        }
        const config: DiskConfig = {
            setId: selectedDiskId,
            rank: diskRank,
            slot: diskSlot,
            mainStat,
            subStatIds,
            subStatRolls,
            allowOverLimitRolls,
        };
        const validationError = getDiskConfigError(config);
        if (validationError) {
            toast.error(validationError);
            return;
        }
        const currentDraft = currentDraftSlots;
        const updatedDraft = [...currentDraft.filter((disk) => disk.slot !== diskSlot), config].sort((a, b) => a.slot - b.slot);
        const existingSet = activeDraftSet;
        const baseName = catalog?.disks.find((item) => item.id === selectedDiskId)?.name ?? "Drive Disc Set";
        const existingName = diskSetName.trim() || existingSet?.name;
        let name = (existingName || baseName).slice(0, 40);
        if (!existingSet && !existingName) {
            let suffix = 2;
            while (savedDiskSets.some((set) => set.name.toLowerCase() === name.toLowerCase())) {
                const numberedName = `${baseName} ${suffix}`;
                name = numberedName.slice(0, 40);
                suffix += 1;
            }
        }

        const savedSet: SavedDiskSet = {
            id: existingSet?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            name,
            setId: existingSet?.setId ?? draftDiskSetId ?? selectedDiskId,
            disks: updatedDraft,
            targetAgentId: existingSet?.targetAgentId,
        };
        const updatedSets = existingSet
            ? savedDiskSets.map((set) => set.id === existingSet.id ? savedSet : set)
            : [...savedDiskSets, savedSet];
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
            setDraftDiskSetId(savedSet.setId);
            setDraftDiskSlots(updatedDraft);
            setDraftSavedSetId(savedSet.id);
            setDiskSetName(savedSet.name);
            toast.success(`Saved Slot ${diskSlot} to "${savedSet.name}" (${updatedDraft.length}/6 discs).`);
        } catch (error: unknown) {
            toast.error(`Could not save Slot ${diskSlot}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const startNewDiskSet = () => {
        if (!selectedDiskId) {
            toast.error("Select a Drive Disc set first.");
            return;
        }
        setDraftDiskSetId(selectedDiskId);
        setDraftDiskSlots([]);
        setDraftSavedSetId(null);
        setDiskSetName("");
        setDiskSlot(1);
        setDiskRank(4);
        setMainStat(MAIN_STATS_BY_SLOT[1][0]);
        setSubStatIds([0, 0, 0, 0]);
        setSubStatRolls([0, 0, 0, 0]);
        setAllowOverLimitRolls(false);
    };

    const addSavedDiskSet = (savedSet: SavedDiskSet) => {
        if (savedSet.disks.length === 0) {
            toast.error(`"${savedSet.name}" has no discs to add yet.`);
            return;
        }
        if (!validUid) {
            toast.error("Enter a valid player UID between 1 and 4,294,967,295.");
            return;
        }
        const invalidDisk = savedSet.disks.find((disk) => getDiskConfigError(disk));
        if (invalidDisk) {
            toast.error(getDiskConfigError(invalidDisk) ?? "A saved Drive Disc is invalid.");
            return;
        }
        void submit(async () => {
            localStorage.setItem("hoyoPlayerUid", String(uid));
            let created = 0;
            for (const disk of [...savedSet.disks].sort((a, b) => a.slot - b.slot)) {
                try {
                    const [ok, message] = await HoyoService.CreateDisk(
                        uid,
                        disk.setId ?? savedSet.setId,
                        disk.rank,
                        disk.slot,
                        disk.mainStat,
                        disk.subStatIds,
                        disk.subStatRolls,
                    );
                    if (!ok) {
                        return [false, `Added ${created}/${savedSet.disks.length} discs. Slot ${disk.slot} failed: ${message || "The Remielle control request failed."}`];
                    }
                    created += 1;
                } catch (error: unknown) {
                    return [false, `Added ${created}/${savedSet.disks.length} discs. Slot ${disk.slot} failed: ${error instanceof Error ? error.message : String(error)}`];
                }
            }
            return [true, ""];
        }, `Added ${savedSet.disks.length} ${savedSet.disks.length === 1 ? "disc" : "discs"} from "${savedSet.name}".`);
    };

    const equipSavedDiskSet = (savedSet: SavedDiskSet) => {
        const agent = catalog?.characters.find((character) => character.id === savedSet.targetAgentId);
        if (!agent) {
            toast.error(`Select an Agent for "${savedSet.name}" before equipping this loadout.`);
            return;
        }
        const invalidDisk = savedSet.disks.find((disk) => getDiskConfigError(disk));
        if (invalidDisk) {
            toast.error(getDiskConfigError(invalidDisk) ?? "A saved Drive Disc is invalid.");
            return;
        }
        const disks = [...savedSet.disks].sort((a, b) => a.slot - b.slot);
        setConfirmationDialog({
            eyebrow: "EQUIP DRIVE DISC LOADOUT",
            title: `Equip "${savedSet.name}"?`,
            description: `This equips ${disks.length} Drive Disc${disks.length === 1 ? "" : "s"} to ${agent.name} on UID ${uid}.`,
            details: [
                "The UID will be disconnected before the save is updated.",
                "Existing equipped discs in the selected slots will be replaced.",
                "Reconnect after the update completes.",
            ],
            confirmLabel: "EQUIP LOADOUT",
            onConfirm: () => {
                setConfirmationDialog(null);
                void submitAndRefreshInventory(
                    () => HoyoService.EquipDiskSet(
                        uid,
                        agent.id,
                        disks.map((disk) => disk.setId ?? savedSet.setId),
                        disks.map((disk) => disk.rank),
                        disks.map((disk) => disk.slot),
                        disks.map((disk) => disk.mainStat),
                        disks.map((disk) => disk.subStatIds),
                        disks.map((disk) => disk.subStatRolls),
                    ),
                    `Equipped Drive Discs to ${agent.name}.`,
                );
            },
        });
    };

    const setSavedDiskSetTarget = (savedSet: SavedDiskSet, targetAgentId: number | undefined) => {
        const updatedSets = savedDiskSets.map((set) =>
            set.id === savedSet.id ? { ...set, targetAgentId } : set,
        );
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
        } catch (error: unknown) {
            toast.error(`Could not save Agent selection: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const equipRecommendedDisks = (character: CatalogItem, recommendation: DiscRecommendation) => {
        const disks = buildRecommendedDisks(recommendation);
        const invalidDisk = disks.find((disk) => getDiskConfigError(disk));
        if (invalidDisk) {
            toast.error(getDiskConfigError(invalidDisk) ?? "The recommended Drive Disc build is invalid.");
            return;
        }
        setConfirmationDialog({
            eyebrow: "RECOMMENDED BUILD",
            title: `Equip a build for ${character.name}?`,
            description: `This creates and equips six recommended S-Rank Drive Discs for UID ${uid}.`,
            details: [
                "New discs are added to the account inventory.",
                "The UID will be disconnected before the save is updated.",
                "Reconnect after the update completes.",
            ],
            confirmLabel: "CREATE & EQUIP BUILD",
            onConfirm: () => {
                setConfirmationDialog(null);
                void submitAndRefreshInventory(
                    () => HoyoService.EquipDiskSet(
                        uid,
                        character.id,
                        disks.map((disk) => disk.setId ?? (disk.slot <= 4 ? recommendation.fourPieceSetId : recommendation.twoPieceSetId)),
                        disks.map((disk) => disk.rank),
                        disks.map((disk) => disk.slot),
                        disks.map((disk) => disk.mainStat),
                        disks.map((disk) => disk.subStatIds),
                        disks.map((disk) => disk.subStatRolls),
                    ),
                    `Recommended Drive Discs equipped to ${character.name}.`,
                );
            },
        });
    };

    const deleteSelectedCharacterSave = (character: CatalogItem) => {
        setConfirmationDialog({
            eyebrow: "PERMANENT SAVE CHANGE",
            title: `Delete ${character.name}?`,
            description: `This removes the Agent and their equipped Drive Discs/W-Engine from UID ${uid}'s account save.`,
            details: [
                "Items used by another Agent will be kept.",
                "A .bin backup is created before the change.",
                "Remielle will disconnect this UID. This cannot be undone in-game.",
            ],
            confirmLabel: "DELETE FROM SAVE",
            danger: true,
            onConfirm: () => {
                setConfirmationDialog(null);
                void submitAndRefreshInventory(
                    () => HoyoService.DeleteCharacterSave(uid, character.id),
                    `${character.name} and its equipped items were removed from the game save.`,
                );
            },
        });
    };

    const deleteAllOtherCharacters = (character: CatalogItem) => {
        setConfirmationDialog({
            eyebrow: "DELETE ALL OTHER AGENTS",
            title: `Keep ${character.name} and delete the rest?`,
            description: `This removes every other Agent from UID ${uid}'s account save. ${character.name} will be kept as the only character.`,
            details: [
                `Gear used by ${character.name} will be kept; other Agents and their gear will be removed.`,
                "A single .bin backup is created before the change.",
                "Remielle will disconnect this UID. This cannot be undone in-game.",
            ],
            confirmLabel: "DELETE OTHER AGENTS",
            danger: true,
            onConfirm: () => {
                setConfirmationDialog(null);
                void submitAndRefreshInventory(
                    () => HoyoService.DeleteAllCharactersSave(uid, character.id),
                    `Deleted all other Agents. ${character.name} was kept in the game save.`,
                );
            },
        });
    };

    const deleteInventoryItem = (itemType: "disk" | "weapon", item: SaveInventoryItem) => {
        const catalogItem = itemType === "disk"
            ? catalog?.disks.find((entry) => entry.id === item.setId)
            : catalog?.weapons.find((entry) => entry.id === item.id);
        const itemName = catalogItem?.name ?? (itemType === "disk" ? `Drive Disc ${item.setId}` : `W-Engine ${item.id}`);
        const label = itemType === "disk" ? `Slot ${item.slot} ${itemName}` : itemName;
        const equippedNames = (item.equippedToAgentIds ?? [])
            .map((agentId) => catalog?.characters.find((agent) => agent.id === agentId)?.name)
            .filter((name): name is string => Boolean(name));
        setConfirmationDialog({
            eyebrow: `DELETE ${itemType === "disk" ? "DRIVE DISC" : "W-ENGINE"}`,
            title: `Delete ${label}?`,
            description: `This permanently removes the selected item from UID ${uid}'s game save.`,
            details: [
                equippedNames.length > 0
                    ? `It will be unequipped from ${equippedNames.join(", ")}.`
                    : "This item is currently unequipped.",
                "A .bin backup is created before the change.",
                "Remielle will disconnect this UID. This cannot be undone in-game.",
            ],
            confirmLabel: "DELETE ITEM",
            danger: true,
            onConfirm: () => {
                setConfirmationDialog(null);
                void submitAndRefreshInventory(
                    () => HoyoService.DeleteInventoryItem(uid, itemType, item.uid),
                    `${label} was deleted from the game save.`,
                );
            },
        });
    };

    const deleteAllInventoryItems = () => {
        if (!currentSaveInventory) {
            toast.error("Load the account inventory before deleting its items.");
            return;
        }
        const diskCount = currentSaveInventory.disks.length;
        const weaponCount = currentSaveInventory.weapons.length;
        const equippedAgentIds = new Set([
            ...currentSaveInventory.disks.flatMap((item) => item.equippedToAgentIds ?? []),
            ...currentSaveInventory.weapons.flatMap((item) => item.equippedToAgentIds ?? []),
        ]);
        if (diskCount + weaponCount === 0) {
            toast.info("No Drive Discs or W-Engines to delete.");
            return;
        }
        setConfirmationDialog({
            eyebrow: "DELETE ALL GAME GEAR",
            title: `Delete all ${diskCount + weaponCount} items?`,
            description: `This permanently deletes every Drive Disc and W-Engine from UID ${uid}'s account save.`,
            details: [
                `${diskCount} Drive Discs and ${weaponCount} W-Engines will be deleted, including equipped items.`,
                equippedAgentIds.size > 0
                    ? `All gear will be unequipped from ${equippedAgentIds.size} Agent(s) before removal.`
                    : "None of these items are currently equipped.",
                "A single .bin backup is created before the change. Remielle will disconnect this UID.",
            ],
            confirmLabel: "DELETE ALL GEAR",
            danger: true,
            onConfirm: () => {
                setConfirmationDialog(null);
                void submitAndRefreshInventory(
                    () => HoyoService.DeleteAllInventoryItems(uid),
                    "All Drive Discs and W-Engines were deleted from the game save.",
                );
            },
        });
    };

    const editSavedDiskSlot = (savedSet: SavedDiskSet, slot: number) => {
        const disk = savedSet.disks.find((entry) => entry.slot === slot);
        const setId = disk?.setId ?? savedSet.setId;
        setSelectedDiskId(setId);
        setDraftDiskSetId(savedSet.setId);
        setDraftDiskSlots(savedSet.disks);
        setDraftSavedSetId(savedSet.id);
        setDiskSetName(savedSet.name);
        setDiskSlot(slot);
        setDiskRank(disk?.rank ?? 4);
        setMainStat(disk?.mainStat ?? MAIN_STATS_BY_SLOT[slot][0]);
        setSubStatIds(disk ? [...disk.subStatIds] : [0, 0, 0, 0]);
        setSubStatRolls(disk ? [...disk.subStatRolls] : [0, 0, 0, 0]);
        setAllowOverLimitRolls(disk?.allowOverLimitRolls ?? false);
    };

    const deleteSavedDiskSet = (savedSet: SavedDiskSet) => {
        setConfirmationDialog({
            eyebrow: "DELETE SAVED LOADOUT",
            title: `Delete "${savedSet.name}"?`,
            description: "This removes the loadout from this Launcher. It does not change your game save or inventory.",
            details: ["This only deletes the local saved configuration.", "Already equipped Drive Discs will not be affected."],
            confirmLabel: "DELETE LOADOUT",
            danger: true,
            onConfirm: () => {
                setConfirmationDialog(null);
                const updatedSets = savedDiskSets.filter((set) => set.id !== savedSet.id);
                try {
                    localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
                    setSavedDiskSets(updatedSets);
                    if (draftSavedSetId === savedSet.id) {
                        setDraftSavedSetId(null);
                        setDraftDiskSlots([]);
                        setDraftDiskSetId(null);
                    }
                    toast.success(`Deleted saved set "${savedSet.name}".`);
                } catch (error: unknown) {
                    toast.error(`Could not delete saved Drive Disc set: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        });
    };

    const duplicateSavedDiskSet = (savedSet: SavedDiskSet) => {
        const baseName = `${savedSet.name} Copy`;
        let name = baseName.slice(0, 40);
        let suffix = 2;
        while (savedDiskSets.some((set) => set.name.toLowerCase() === name.toLowerCase())) {
            const suffixText = ` Copy ${suffix}`;
            name = `${savedSet.name.slice(0, 40 - suffixText.length)}${suffixText}`;
            suffix += 1;
        }
        const duplicatedSet: SavedDiskSet = {
            ...savedSet,
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            name,
            disks: savedSet.disks.map((disk) => ({
                ...disk,
                subStatIds: [...disk.subStatIds],
                subStatRolls: [...disk.subStatRolls],
            })),
        };
        const updatedSets = [...savedDiskSets, duplicatedSet];
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
            setSelectedDiskId(duplicatedSet.setId);
            setDraftDiskSetId(duplicatedSet.setId);
            setDraftDiskSlots(duplicatedSet.disks);
            setDraftSavedSetId(duplicatedSet.id);
            setDiskSetName(duplicatedSet.name);
            const nextSlot = [1, 2, 3, 4, 5, 6].find((slot) => !duplicatedSet.disks.some((disk) => disk.slot === slot)) ?? 1;
            const diskToEdit = duplicatedSet.disks.find((disk) => disk.slot === nextSlot);
            setDiskSlot(nextSlot);
            if (diskToEdit) {
                setDiskRank(diskToEdit.rank);
                setMainStat(diskToEdit.mainStat);
                setSubStatIds(diskToEdit.subStatIds);
                setSubStatRolls(diskToEdit.subStatRolls);
                setAllowOverLimitRolls(diskToEdit.allowOverLimitRolls);
            } else {
                setDiskRank(4);
                setMainStat(MAIN_STATS_BY_SLOT[nextSlot][0]);
                setSubStatIds([0, 0, 0, 0]);
                setSubStatRolls([0, 0, 0, 0]);
                setAllowOverLimitRolls(false);
            }
            toast.success(`Duplicated "${savedSet.name}" as "${name}".`);
        } catch (error: unknown) {
            toast.error(`Could not duplicate saved Drive Disc set: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const updateDiskSetName = (name: string) => {
        setDiskSetName(name);
        const normalizedName = name.trim().slice(0, 40);
        if (!normalizedName || !draftSavedSetId) return;
        const updatedSets = savedDiskSets.map((set) =>
            set.id === draftSavedSetId ? { ...set, name: normalizedName } : set,
        );
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
        } catch (error: unknown) {
            toast.error(`Could not auto-save the set name: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const savedDiskEditKey = (savedSet: SavedDiskSet, disk: DiskConfig) => `${savedSet.id}:${disk.slot}`;

    const updateSavedDiskEdit = (key: string, update: (disk: DiskConfig) => DiskConfig) => {
        const currentDisk = editingSavedDisks[key];
        if (!currentDisk) return;
        const updatedDisk = update(currentDisk);
        setEditingSavedDisks((current) => ({ ...current, [key]: updatedDisk }));

        if (getDiskConfigError(updatedDisk)) return;
        const [setId, slotText] = key.split(":");
        const slot = Number(slotText);
        const updatedSets = savedDiskSets.map((set) => set.id === setId
            ? { ...set, disks: set.disks.map((disk) => disk.slot === slot ? updatedDisk : disk) }
            : set);
        try {
            localStorage.setItem(SAVED_DISK_SETS_KEY, JSON.stringify(updatedSets));
            setSavedDiskSets(updatedSets);
        } catch (error: unknown) {
            toast.error(`Could not auto-save Drive Disc changes: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const createDefaultDisk = () => {
        if (!selectedDiskId) {
            toast.error("Select a Drive Disc set first.");
            return;
        }
        const defaultSubstats = [11102, 12103, 12102, 13103];
        setDiskSlot(1);
        setDiskRank(2);
        setMainStat(11103);
        setSubStatIds(defaultSubstats);
        setSubStatRolls([0, 0, 0, 0]);
        void submit(
            () => HoyoService.CreateDisk(uid, selectedDiskId, 2, 1, 11103, defaultSubstats, [0, 0, 0, 0]),
            "Default B-Rank Drive Disc created.",
        );
    };

    const applyDefaultAgent = () => {
        if (!selectedAgentId) {
            toast.error("Select an agent first.");
            return;
        }
        const defaultSkills = SKILLS.reduce((levels, skill) => {
            levels[skill.id] = 1;
            return levels;
        }, [0, 0, 0, 0, 0, 0, 0]);
        setAgentLevel(1);
        setSkillLevels(defaultSkills);
        setMindscape(0);
        setPotentialLevel(0);
        void submit(
            () => HoyoService.ModifyCharacter(uid, selectedAgentId, 1, defaultSkills, 0, 0, 0),
            "Agent set to default values.",
        );
    };

    const createDefaultWeapon = () => {
        if (!selectedWeaponId) {
            toast.error("Select a W-Engine first.");
            return;
        }
        setWeaponLevel(1);
        setRefinement(1);
        void submit(
            () => HoyoService.CreateWeapon(uid, selectedWeaponId, 1, 1),
            "Default W-Engine created.",
        );
    };

    const randomizeDiskStats = () => {
        if (mainStatOptions.indexOf(mainStat) < 0) {
            toast.error("Select a valid slot and main stat first.");
            return;
        }
        const available = SUBSTAT_IDS.filter((id) => id !== mainStat);
        for (let index = available.length - 1; index > 0; index--) {
            const swap = Math.floor(Math.random() * (index + 1));
            [available[index], available[swap]] = [available[swap], available[index]];
        }
        setSubStatIds(available.slice(0, 4));
    };

    const randomizeDiskRolls = () => {
        const randomRolls = [0, 0, 0, 0];
        const rollsToAssign = Math.floor(Math.random() * (rollLimit + 1));
        for (let index = 0; index < rollsToAssign; index++) {
            const eligible = randomRolls
                .map((rolls, index) => rolls < 14 ? index : -1)
                .filter((index) => index >= 0);
            if (eligible.length === 0) break;
            randomRolls[eligible[Math.floor(Math.random() * eligible.length)]] += 1;
        }
        setSubStatRolls(randomRolls);
    };

    const updateSubstat = (index: number, statID: number) => {
        setSubStatIds((current) => current.map((value, i) => i === index ? statID : value));
    };

    const updateSubstatRolls = (index: number, rolls: number) => {
        const otherRolls = totalRolls - subStatRolls[index];
        const fieldMax = Math.min(14, rollLimit - otherRolls);
        const boundedRolls = Number.isFinite(rolls) ? Math.max(0, Math.min(fieldMax, Math.floor(rolls))) : 0;
        setSubStatRolls((current) => current.map((value, i) => i === index ? boundedRolls : value));
    };

    const selectedTab = TABS.find((tab) => tab.id === category) ?? TABS[0];

    return (
        <main className="hoyo-page">
            <header className="hoyo-header">
                <div>
                    <div className="hoyo-eyebrow"><span /> REMIELLE CONTROL CENTER</div>
                    <h1>{activePage === "manage" ? "Save Manager" : "Hoyo Workshop"}</h1>
                    <p>{activePage === "manage" ? "Review and remove characters and gear in the selected UID's game save." : "Build Drive Disc loadouts, equip Agents, tune characters, and add W-Engines."}</p>
                </div>
                <label className={`hoyo-uid ${validUid ? "" : "is-invalid"}`}>
                    <span>PLAYER UID</span>
                    <input
                        type="number"
                        min="1"
                        max="4294967295"
                        value={playerUid}
                        onChange={(event) => setPlayerUid(event.target.value)}
                        aria-invalid={!validUid}
                    />
                </label>
            </header>

            <div className="hoyo-notice">
                <ShieldCheck size={17} />
                <span>Live controls use <strong>127.0.0.1:15810</strong> and require an online UID. Equipping a saved Drive Disc set updates the account save and disconnects that UID if Remielle is running.</span>
            </div>
            <p className="hoyo-artwork-note">Artwork is loaded from local files in <code>frontend/public/hoyo/</code>; see that folder for the expected image names.</p>

            <nav className="hoyo-tabs" aria-label="Hoyo tools">
                {TABS.map((tab, index) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={activePage === "workshop" && category === tab.id ? "is-active" : ""}
                        onClick={() => {
                            setActivePage("workshop");
                            setCategory(tab.id);
                            setSearch("");
                            setRankFilter(null);
                        }}
                    >
                        <span className="hoyo-tabs__number">0{index + 1}</span>
                        <span>{tab.label}</span>
                        <small>{tab.caption}</small>
                    </button>
                ))}
                <button
                    type="button"
                    className={activePage === "manage" ? "is-active" : ""}
                    onClick={() => setActivePage("manage")}
                >
                    <span className="hoyo-tabs__number">04</span>
                    <span>Manage Save</span>
                    <small>Remove saved game data</small>
                </button>
            </nav>

            {catalogError ? (
                <section className="hoyo-catalog-error" role="alert">
                    <h2>Could not load the item catalogue</h2>
                    <p>{catalogError}</p>
                    <button type="button" onClick={() => void loadCatalog()}>Try again</button>
                    <a href="https://zzz.nanoka.cc/character" target="_blank" rel="noreferrer">Nanoka <ExternalLink size={13} /></a>
                </section>
            ) : !catalog ? (
                <div className="hoyo-loading"><LoaderCircle size={20} className="hoyo-spinner" /> Loading item catalogue…</div>
            ) : (
                <>
                {activePage === "workshop" && (
                <section className="hoyo-workspace">
                    <div className="hoyo-catalog">
                        <div className="hoyo-catalog__toolbar">
                            <label className="hoyo-search">
                                <Search size={16} />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={`Search ${selectedTab.label.toLowerCase()}…`}
                                    aria-label={`Search ${selectedTab.label}`}
                                />
                            </label>
                            {(category === "characters" || category === "weapons") && (
                                <div className="hoyo-rank-filter" role="group" aria-label="Filter by rank">
                                    {RANK_FILTERS.map((filter) => (
                                        <button
                                            key={filter.label}
                                            type="button"
                                            className={rankFilter === filter.rank ? "is-active" : ""}
                                            aria-pressed={rankFilter === filter.rank}
                                            onClick={() => setRankFilter(filter.rank)}
                                        >
                                            {filter.label}
                                            {filter.rank !== null && <small>{rankCounts[filter.rank] ?? 0}</small>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <span>{filteredItems.length} ITEMS</span>
                        </div>
                        {filteredItems.length > 0 ? (
                            <div className="hoyo-grid">
                                {filteredItems.map((item) => (
                                    <CatalogCard
                                        key={`${category}-${item.id}`}
                                        item={item}
                                        category={category}
                                        selected={selectedItemId === item.id}
                                        onSelect={() => {
                                            if (category === "disks") setSelectedDiskId(item.id);
                                            if (category === "characters") {
                                                setSelectedAgentId(item.id);
                                                setPotentialLevel(-1);
                                                setAvatarSkinID(0);
                                            }
                                            if (category === "weapons") setSelectedWeaponId(item.id);
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="hoyo-empty">
                                {rankFilter !== null && (rankCounts[rankFilter] ?? 0) === 0
                                    ? `No ${RANK_FILTERS.find((filter) => filter.rank === rankFilter)?.label}-rank ${selectedTab.label.toLowerCase()} in this catalogue.`
                                    : `No items match “${search.trim()}”${rankFilter === null ? "" : ` in ${RANK_FILTERS.find((filter) => filter.rank === rankFilter)?.label}-rank items`}.`}
                            </div>
                        )}
                        <div className="hoyo-attribution">
                            Artwork and item data from <a href={category === "disks" ? "https://zzz.nanoka.cc/equipment" : "https://zzz.nanoka.cc/character"} target="_blank" rel="noreferrer">Nanoka <ExternalLink size={12} /></a>
                        </div>
                    </div>

                    <aside className="hoyo-editor">
                        <div className="hoyo-editor__heading">
                            <span>CONFIGURATION</span>
                            <h2>{selectedItem?.name ?? selectedTab.label}</h2>
                            <p>{selectedItem ? `Selected item · ${selectedItem.id}` : "Choose an item from the catalogue to begin."}</p>
                        </div>

                        {category === "disks" && selectedItem && (selectedItem.twoPieceEffect || selectedItem.fourPieceEffect) && (
                            <section className="hoyo-disk-bonuses" aria-label={`${selectedItem.name} set bonuses`}>
                                <span className="hoyo-disk-bonuses__eyebrow">SET BONUSES</span>
                                {selectedItem.twoPieceEffect && (
                                    <div>
                                        <b>2-PIECE</b>
                                        <p>{selectedItem.twoPieceEffect}</p>
                                    </div>
                                )}
                                {selectedItem.fourPieceEffect && (
                                    <div>
                                        <b>4-PIECE</b>
                                        <p>{selectedItem.fourPieceEffect}</p>
                                    </div>
                                )}
                            </section>
                        )}

                        {category === "characters" && selectedCharacter && (
                            <section className="hoyo-agent-disc-recommendation" aria-label="Recommended Drive Disc build">
                                <div className="hoyo-agent-disc-recommendation__heading">
                                    <span>RECOMMENDED BUILD</span>
                                    <b>{selectedAgentRecommendation?.role ?? "NO PRESET"}</b>
                                </div>
                                {selectedAgentRecommendation ? (
                                    <>
                                        <p className="hoyo-agent-disc-recommendation__note">
                                            {selectedAgentRecommendation.note}
                                        </p>
                                        <details className="hoyo-agent-disc-recommendation__customizer">
                                            <summary>
                                                CUSTOMIZE BUILD
                                                {selectedAgentOverride && <span>CUSTOM SAVED</span>}
                                            </summary>
                                            <p>Changes are saved on this device and used by Create &amp; Equip.</p>
                                            <DiskSetPicker
                                                label="4-PIECE DRIVE DISC"
                                                disks={catalog?.disks ?? []}
                                                selectedSetId={selectedAgentRecommendation.fourPieceSetId}
                                                onChange={(setId) => updateSelectedAgentRecommendation({ fourPieceSetId: setId })}
                                            />
                                            <DiskSetPicker
                                                label="2-PIECE DRIVE DISC"
                                                disks={catalog?.disks ?? []}
                                                selectedSetId={selectedAgentRecommendation.twoPieceSetId}
                                                onChange={(setId) => updateSelectedAgentRecommendation({ twoPieceSetId: setId })}
                                            />
                                            <div className="hoyo-agent-disc-recommendation__edit-stats">
                                                {[4, 5, 6].map((slot) => (
                                                    <label className="hoyo-field" key={slot}>
                                                        <span>SLOT {slot} MAIN STAT</span>
                                                        <select
                                                            value={selectedAgentRecommendation.mainStats[slot]}
                                                            onChange={(event) => updateSelectedAgentRecommendation({
                                                                mainStats: { ...selectedAgentRecommendation.mainStats, [slot]: Number(event.target.value) },
                                                            })}
                                                        >
                                                            {(MAIN_STATS_BY_SLOT[slot] ?? []).map((statId) => (
                                                                <option key={statId} value={statId}>{getStatName(statId)}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="hoyo-agent-disc-recommendation__edit-substats">
                                                <span>SUBSTAT PRIORITY · RANDOMIZE THE REST</span>
                                                {selectedAgentRecommendation.subStats.map((selectedStatId, index) => (
                                                    <label className="hoyo-field" key={index}>
                                                        <span>PRIORITY {index + 1}</span>
                                                        <select
                                                            value={selectedStatId}
                                                            onChange={(event) => {
                                                                const updatedSubStats = [...selectedAgentRecommendation.subStats];
                                                                updatedSubStats[index] = Number(event.target.value);
                                                                updateSelectedAgentRecommendation({ subStats: updatedSubStats });
                                                            }}
                                                        >
                                                            <option value={0}>Random</option>
                                                            {SUBSTAT_IDS
                                                                .filter((statId) => statId === selectedStatId ||
                                                                    !selectedAgentRecommendation.subStats.includes(statId))
                                                                .map((statId) => (
                                                                    <option key={statId} value={statId}>{getStatName(statId)}</option>
                                                                ))}
                                                        </select>
                                                    </label>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                className="hoyo-button hoyo-button--muted"
                                                disabled={!selectedAgentOverride}
                                                onClick={resetSelectedAgentRecommendation}
                                            >
                                                RESET TO DEFAULT
                                            </button>
                                            <p>To include your saved settings in the next build, export the JSON and replace <code>frontend/src/pages/hoyo/disc-recommendations.json</code> in the project.</p>
                                            <button
                                                type="button"
                                                className="hoyo-button hoyo-button--primary"
                                                disabled={isExportingDiscRecommendations || Object.keys(discRecommendationOverrides).length === 0}
                                                onClick={() => void exportDiscRecommendationsForBuild()}
                                            >
                                                {isExportingDiscRecommendations ? "SAVING JSON…" : "SAVE JSON FOR BUILD"}
                                            </button>
                                        </details>
                                        {selectedAgentRecommendation.alternativeTwoPieceSetIds.length > 0 && (
                                            <p className="hoyo-agent-disc-recommendation__alternatives">
                                                2-PIECE ALTERNATIVES: {selectedAgentRecommendation.alternativeTwoPieceSetIds
                                                    .map((setId) => catalog?.disks.find((disk) => disk.id === setId)?.name)
                                                    .filter((name): name is string => Boolean(name))
                                                    .join(" · ")}
                                            </p>
                                        )}
                                        <a
                                            className="hoyo-agent-disc-recommendation__source"
                                            href={selectedAgentRecommendation.source}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            GUIDE UPDATED {selectedAgentRecommendation.guideUpdated} <ExternalLink size={10} />
                                        </a>
                                        <div className="hoyo-agent-disc-recommendation__sets">
                                            {[selectedAgentRecommendation.fourPieceSetId, selectedAgentRecommendation.twoPieceSetId].map((setId, index) => {
                                                const set = catalog?.disks.find((disk) => disk.id === setId);
                                                return (
                                                    <div key={setId}>
                                                        <span className="hoyo-agent-disc-recommendation__set-art">
                                                            <Sparkles size={16} aria-hidden="true" />
                                                            {set?.imagePath && (
                                                                <img
                                                                    src={set.imagePath}
                                                                    alt=""
                                                                    loading="lazy"
                                                                    onError={(event) => {
                                                                        event.currentTarget.hidden = true;
                                                                    }}
                                                                />
                                                            )}
                                                        </span>
                                                        <b>{index === 0 ? "4-PIECE" : "2-PIECE"}</b>
                                                        <span className="hoyo-agent-disc-recommendation__set-name">{set?.name ?? `Drive Disc ${setId}`}</span>
                                                        <small>{index === 0 ? set?.fourPieceEffect : set?.twoPieceEffect}</small>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="hoyo-agent-disc-recommendation__stats">
                                            {[4, 5, 6].map((slot) => (
                                                <div key={slot}>
                                                    <b>{slot}</b>
                                                    <span>{getStatName(selectedAgentRecommendation.mainStats[slot])}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="hoyo-agent-disc-recommendation__substats">
                                            <b>SUBSTATS</b>
                                            {selectedAgentRecommendation.subStats.map(getStatName).join(" · ")}
                                        </p>
                                        <button
                                            type="button"
                                            className="hoyo-button hoyo-button--primary hoyo-button--full"
                                            disabled={isSubmitting || !validUid}
                                            onClick={() => equipRecommendedDisks(selectedCharacter, selectedAgentRecommendation)}
                                        >
                                            {isSubmitting ? "APPLYING BUILD…" : "CREATE & EQUIP RECOMMENDED BUILD"}
                                        </button>
                                    </>
                                ) : (
                                    <p className="hoyo-agent-disc-recommendation__note">
                                        No character-specific Drive Disc recommendation has been verified for this Agent yet. A role-only preset is intentionally not shown.
                                    </p>
                                )}
                            </section>
                        )}

                        {category === "disks" && (
                            <div className="hoyo-editor__body">
                                <div className="hoyo-max-row">
                                    <span>QUICK ACTION</span>
                                    <button
                                        type="button"
                                        className="hoyo-max-button"
                                        disabled={isSubmitting || !selectedDiskId}
                                        onClick={createDefaultDisk}
                                        title="Create a B-Rank Slot 1 disc with default stats"
                                    >
                                        ADD DEFAULT
                                    </button>
                                </div>
                                <section className="hoyo-disk-set-builder" aria-label="Save a six-disc set">
                                    <div className="hoyo-max-row">
                                        <span>6-DISC SET · AUTO-SAVE</span>
                                        <b>{draftSlotCount}/6 SLOTS</b>
                                    </div>
                                    <p>Start a new set anytime, even with the same Drive Disc type and stats as an existing set.</p>
                                    <button
                                        type="button"
                                        className="hoyo-button hoyo-button--muted"
                                        disabled={!selectedDiskId}
                                        onClick={startNewDiskSet}
                                    >
                                        NEW SET
                                    </button>
                                    <div className="hoyo-disk-set-builder__actions">
                                        <button
                                            type="button"
                                            className="hoyo-button hoyo-button--muted"
                                            disabled={isSubmitting || !selectedDiskId}
                                            onClick={saveCurrentDiskSlot}
                                        >
                                            SAVE SLOT {diskSlot}{activeDraftSlot ? " · SAVED" : ""}
                                        </button>
                                    </div>
                                    <label className="hoyo-field">
                                        <span>SET NAME <small>{draftSavedSetId ? "SAVED" : "OPTIONAL · AUTO-NAMED IF BLANK"}</small></span>
                                        <input
                                            type="text"
                                            maxLength={40}
                                            value={diskSetName}
                                            onChange={(event) => updateDiskSetName(event.target.value)}
                                            placeholder="e.g. Ellen Ice Build"
                                        />
                                    </label>
                                </section>
                                <label className="hoyo-field">
                                    <span>DISK SLOT</span>
                                    <select value={diskSlot} onChange={(event) => selectDiskSlot(Number(event.target.value))}>
                                        {[1, 2, 3, 4, 5, 6].map((slot) => <option key={slot} value={slot}>Slot {slot}</option>)}
                                    </select>
                                </label>
                                <label className="hoyo-field">
                                    <span>RARITY</span>
                                    <select value={diskRank} onChange={(event) => setDiskRank(Number(event.target.value))}>
                                        <option value={2}>B-Rank</option>
                                        <option value={3}>A-Rank</option>
                                        <option value={4}>S-Rank</option>
                                    </select>
                                </label>
                                <label className="hoyo-field">
                                    <span>MAIN STAT</span>
                                    <select value={mainStat} onChange={(event) => {
                                        setMainStat(Number(event.target.value));
                                        setSubStatIds([0, 0, 0, 0]);
                                        setSubStatRolls([0, 0, 0, 0]);
                                    }}>
                                        {mainStatOptions.map((id) => <option key={id} value={id}>{getStatName(id)}</option>)}
                                    </select>
                                </label>
                                <div className="hoyo-substats">
                                    <div className="hoyo-substats__heading">
                                        <span>SUBSTATS</span>
                                        <b>{totalRolls} / {rollLimit} EXTRA ROLLS</b>
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            aria-pressed={allowOverLimitRolls}
                                            disabled={isSubmitting}
                                            onClick={() => setAllowOverLimitRolls((enabled) => !enabled)}
                                        >
                                            {allowOverLimitRolls ? "OVER LIMIT ON" : "ALLOW OVER LIMIT"}
                                        </button>
                                    </div>
                                    {subStatIds.map((statID, index) => {
                                        const choices = SUBSTAT_IDS.filter((id) =>
                                            id !== mainStat && (id === statID || !subStatIds.some((other, otherIndex) => otherIndex !== index && other === id)),
                                        );
                                        const otherRolls = totalRolls - subStatRolls[index];
                                        return (
                                            <div className="hoyo-substat-row" key={`substat-${index}`}>
                                                <select value={statID} onChange={(event) => updateSubstat(index, Number(event.target.value))} aria-label={`Substat ${index + 1}`}>
                                                    <option value={0}>Choose stat {index + 1}</option>
                                                    {choices.map((id) => <option key={id} value={id}>{getStatName(id)}</option>)}
                                                </select>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={Math.max(0, Math.min(14, rollLimit - otherRolls))}
                                                    value={subStatRolls[index]}
                                                    onChange={(event) => updateSubstatRolls(index, Number(event.target.value))}
                                                    aria-label={`Additional rolls for substat ${index + 1}`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="hoyo-editor__actions hoyo-editor__actions--disks">
                                    <button type="button" className="hoyo-button hoyo-button--muted" disabled={isSubmitting} onClick={randomizeDiskStats}>Randomize stats</button>
                                    <button type="button" className="hoyo-button hoyo-button--muted" disabled={isSubmitting} onClick={randomizeDiskRolls}>Randomize rolls</button>
                                    <button type="button" className="hoyo-button hoyo-button--primary" disabled={isSubmitting || !selectedDiskId || totalRolls > rollLimit} onClick={() => createDisk()}>
                                        {isSubmitting ? "Sending…" : "Add Drive Disc"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {category === "characters" && (
                            <div className="hoyo-editor__body">
                                <div className="hoyo-max-row">
                                    <span>AGENT LEVEL & SKILLS</span>
                                    <div className="hoyo-quick-actions">
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            disabled={isSubmitting || !selectedAgentId}
                                            onClick={applyDefaultAgent}
                                            title="Set this agent to level 1, skill levels 1, and Mindscape 0"
                                        >
                                            APPLY DEFAULT
                                        </button>
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            disabled={isSubmitting}
                                            onClick={() => {
                                                setAgentLevel(60);
                                                setSkillLevels(SKILLS.reduce((levels, skill) => {
                                                    levels[skill.id] = skill.max;
                                                    return levels;
                                                }, [0, 0, 0, 0, 0, 0, 0]));
                                                setMindscape(6);
                                                setPotentialLevel(potentialIDs.length > 0 ? Math.min(potentialIDs.length, 6) : -1);
                                            }}
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>
                                <NumberField label="AGENT LEVEL" min={1} max={60} value={agentLevel} optional onChange={setAgentLevel} />
                                <div className="hoyo-skills">
                                    <div className="hoyo-substats__heading"><span>SKILL LEVELS</span><b>LEAVE BLANK TO KEEP</b></div>
                                    {SKILLS.map((skill) => (
                                        <NumberField
                                            key={skill.name}
                                            label={skill.name}
                                            min={1}
                                            max={skill.max}
                                            value={skillLevels[skill.id]}
                                            optional
                                            onChange={(value) => setSkillLevels((current) => current.map((level, id) => id === skill.id ? value : level))}
                                        />
                                    ))}
                                </div>
                                <label className="hoyo-field">
                                    <span>MINDSCAPE <small>OPTIONAL</small></span>
                                    <select value={mindscape} onChange={(event) => setMindscape(Number(event.target.value))}>
                                        <option value={-1}>Leave unchanged</option>
                                        {[0, 1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>M{value}</option>)}
                                    </select>
                                </label>
                                <label className="hoyo-field">
                                    <span>POTENTIAL VISION <small>OPTIONAL</small></span>
                                    <select
                                        value={potentialLevel}
                                        disabled={potentialIDs.length === 0}
                                        onChange={(event) => setPotentialLevel(Number(event.target.value))}
                                    >
                                        {potentialIDs.length === 0 ? (
                                            <option value={-1}>No Potential Vision data</option>
                                        ) : (
                                            <>
                                                <option value={-1}>Leave unchanged</option>
                                                <option value={0}>P0</option>
                                                {potentialIDs.slice(0, 6).map((_, index) => (
                                                    <option key={index + 1} value={index + 1}>P{index + 1}</option>
                                                ))}
                                            </>
                                        )}
                                    </select>
                                </label>
                                <label className="hoyo-field">
                                    <span>CHARACTER SKIN <small>OPTIONAL</small></span>
                                    <select
                                        value={avatarSkinID}
                                        disabled={!selectedAgentId || skinIDs.length === 0}
                                        onChange={(event) => setAvatarSkinID(Number(event.target.value))}
                                    >
                                        <option value={0}>Leave unchanged</option>
                                        {skinIDs.map((skinID, index) => (
                                            <option key={skinID} value={skinID}>
                                                {index === 0 ? "Default" : "Skin"} · {skinID}
                                            </option>
                                        ))}
                                    </select>
                                    {catalog?.skinDataError && skinIDs.length === 0 && (
                                        <small>{catalog.skinDataError}</small>
                                    )}
                                    {!catalog?.skinDataError && selectedAgentId && skinIDs.length === 0 && (
                                        <small>No skins are listed for this character in the current Remielle data.</small>
                                    )}
                                </label>
                                <button
                                    type="button"
                                    className="hoyo-button hoyo-button--muted hoyo-button--full"
                                    disabled={isSubmitting || !selectedAgentId}
                                    onClick={() => {
                                        if (!selectedCharacter) return;
                                        setConfirmationDialog({
                                            eyebrow: "ADD AGENT TO SAVE",
                                            title: `Unlock ${selectedCharacter.name}?`,
                                            description: `This adds the selected Agent to UID ${uid}'s account save.`,
                                            details: [
                                                "A .bin backup is created before the change.",
                                                "The UID will be disconnected before the save is updated.",
                                                "Reconnect after the update completes.",
                                            ],
                                            confirmLabel: "UNLOCK AGENT",
                                            onConfirm: () => {
                                                setConfirmationDialog(null);
                                                void submitAndRefreshInventory(
                                                    () => HoyoService.UnlockCharacter(uid, selectedCharacter.id),
                                                    "Agent unlocked. Reconnect your UID to use it.",
                                                );
                                            },
                                        });
                                    }}
                                >
                                    {isSubmitting ? "Unlocking…" : "Unlock selected Agent"}
                                </button>
                                <div className="hoyo-rank-note">
                                    If Remielle is running, this disconnects the selected UID before updating its save. A backup is created automatically.
                                </div>
                                <button
                                    type="button"
                                    className="hoyo-button hoyo-button--primary hoyo-button--full"
                                    disabled={isSubmitting || !selectedAgentId}
                                    onClick={() => void submit(
                                        () => HoyoService.ModifyCharacter(uid, selectedAgentId!, agentLevel, skillLevels, mindscape, potentialLevel, avatarSkinID),
                                        "Agent updated.",
                                    )}
                                >
                                    {isSubmitting ? "Sending…" : "Apply agent changes"}
                                </button>
                            </div>
                        )}

                        {category === "weapons" && (
                            <div className="hoyo-editor__body">
                                <div className="hoyo-max-row">
                                    <span>W-ENGINE LEVEL & REFINEMENT</span>
                                    <div className="hoyo-quick-actions">
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            disabled={isSubmitting || !selectedWeaponId}
                                            onClick={createDefaultWeapon}
                                            title="Create a level 1 W1 copy of this W-Engine"
                                        >
                                            ADD DEFAULT
                                        </button>
                                        <button
                                            type="button"
                                            className="hoyo-max-button"
                                            disabled={isSubmitting}
                                            onClick={() => {
                                                setWeaponLevel(60);
                                                setRefinement(5);
                                            }}
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>
                                <NumberField label="W-ENGINE LEVEL" min={1} max={60} value={weaponLevel} onChange={setWeaponLevel} />
                                <label className="hoyo-field">
                                    <span>REFINEMENT</span>
                                    <select value={refinement} onChange={(event) => setRefinement(Number(event.target.value))}>
                                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>W{value}</option>)}
                                    </select>
                                </label>
                                <div className="hoyo-rank-note">
                                    <Sparkles size={16} />
                                    Weapon rank is derived from the selected engine. Promotion is calculated from its level.
                                </div>
                                <button
                                    type="button"
                                    className="hoyo-button hoyo-button--primary hoyo-button--full"
                                    disabled={isSubmitting || !selectedWeaponId}
                                    onClick={() => void submit(
                                        () => HoyoService.CreateWeapon(uid, selectedWeaponId!, weaponLevel, refinement),
                                        "W-Engine created.",
                                    )}
                                >
                                    {isSubmitting ? "Sending…" : "Create W-Engine"}
                                </button>
                            </div>
                        )}
                    </aside>
                </section>
                )}
                {activePage === "manage" && (
                    <section className="hoyo-save-manager">
                        <nav className="hoyo-save-manager__tabs" aria-label="Save data categories">
                            {SAVE_MANAGER_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={saveManagerSection === tab.id ? "is-active" : ""}
                                    aria-pressed={saveManagerSection === tab.id}
                                    onClick={() => setSaveManagerSection(tab.id)}
                                >
                                    {tab.label}
                                    <small>
                                        {tab.id === "disks"
                                            ? currentSaveInventory?.disks.length ?? 0
                                            : tab.id === "weapons"
                                                ? currentSaveInventory?.weapons.length ?? 0
                                                : tab.id === "characters"
                                                    ? currentSaveInventory?.characters.length ?? 0
                                                    : savedDiskSets.length}
                                    </small>
                                </button>
                            ))}
                        </nav>
                        {saveManagerSection === "characters" ? (
                            <section className="hoyo-save-characters">
                                <div className="hoyo-save-inventory__heading">
                                    <div>
                                        <span>GAME SAVE · {validUid ? `UID ${uid}` : "UID REQUIRED"}</span>
                                        <h2>Agents</h2>
                                        <p>Choose an Agent from the save. Bulk deletion keeps the selected Agent and their equipped gear.</p>
                                    </div>
                                    <div className="hoyo-save-inventory__heading-actions">
                                        <b>{currentSaveInventory?.characters.length ?? 0} AGENTS</b>
                                        <button
                                            type="button"
                                            className="hoyo-button hoyo-button--muted"
                                            disabled={isLoadingSaveInventory || !validUid}
                                            onClick={() => setInventoryRefreshId((value) => value + 1)}
                                        >
                                            {isLoadingSaveInventory ? <LoaderCircle size={12} className="hoyo-spinner" /> : <RefreshCw size={12} />}
                                            REFRESH
                                        </button>
                                    </div>
                                </div>
                                {!validUid ? (
                                    <div className="hoyo-save-inventory__status">Enter a valid player UID to read the game save.</div>
                                ) : saveInventoryError ? (
                                    <div className="hoyo-save-inventory__status is-error" role="alert">
                                        <AlertTriangle size={14} /><span>{saveInventoryError}</span>
                                    </div>
                                ) : isLoadingSaveInventory && !currentSaveInventory ? (
                                    <div className="hoyo-save-inventory__status"><LoaderCircle size={14} className="hoyo-spinner" /> Reading account save…</div>
                                ) : !currentSaveInventory?.characters.length ? (
                                    <div className="hoyo-save-inventory__empty">No Agents found in this UID&apos;s save.</div>
                                ) : (
                                    <>
                                        <label className="hoyo-save-characters__select">
                                            <span>AGENT TO KEEP OR DELETE</span>
                                            <select
                                                value={selectedSavedCharacterId ?? ""}
                                                onChange={(event) => setSaveCharacterId(Number(event.target.value))}
                                                disabled={isSubmitting}
                                            >
                                                {currentSaveInventory.characters.map((avatarID) => {
                                                    const agent = catalog.characters.find((item) => item.id === avatarID);
                                                    return <option key={avatarID} value={avatarID}>{agent?.name ?? `Agent ${avatarID}`}</option>;
                                                })}
                                            </select>
                                        </label>
                                        {(() => {
                                            const agent = catalog.characters.find((item) => item.id === selectedSavedCharacterId);
                                            if (!agent) return null;
                                            return (
                                                <div className="hoyo-save-characters__actions">
                                                    <article className="hoyo-save-characters__selected">
                                                        {agent.imagePath && <img src={agent.imagePath} alt="" />}
                                                        <div><b>{agent.name}</b><span>AGENT ID {agent.id}</span></div>
                                                    </article>
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--danger"
                                                        disabled={isSubmitting || !validUid || currentSaveInventory.characters.length <= 1}
                                                        onClick={() => deleteSelectedCharacterSave(agent)}
                                                    >
                                                        <Trash2 size={13} /> DELETE THIS AGENT
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--danger"
                                                        disabled={isSubmitting || !validUid || currentSaveInventory.characters.length <= 1}
                                                        onClick={() => deleteAllOtherCharacters(agent)}
                                                    >
                                                        <Trash2 size={13} /> KEEP THIS · DELETE OTHERS
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                        {currentSaveInventory.characters.length <= 1 && (
                                            <p className="hoyo-save-characters__note">The only Agent in the save cannot be deleted.</p>
                                        )}
                                    </>
                                )}
                            </section>
                        ) : saveManagerSection === "loadouts" ? null : (
                <section className="hoyo-save-inventory" aria-label={`${saveManagerSection === "disks" ? "Drive Disc" : "W-Engine"} save inventory`}>
                        <div className="hoyo-save-inventory__heading">
                            <div>
                                <span>GAME SAVE INVENTORY · {validUid ? `UID ${uid}` : "UID REQUIRED"}</span>
                                <h2>{saveManagerSection === "disks" ? "Drive Discs" : "W-Engines"}</h2>
                                <p>Items are read from the account .bin. Delete an item to remove it from inventory and unequip it.</p>
                            </div>
                            <div className="hoyo-save-inventory__heading-actions">
                                <b>{saveManagerSection === "disks" ? currentSaveInventory?.disks.length ?? 0 : currentSaveInventory?.weapons.length ?? 0} ITEMS</b>
                                <button
                                    type="button"
                                    className="hoyo-save-inventory__delete-all"
                                    disabled={isLoadingSaveInventory || isSubmitting || !validUid || !currentSaveInventory || currentSaveInventory.disks.length + currentSaveInventory.weapons.length === 0}
                                    onClick={deleteAllInventoryItems}
                                >
                                    <Trash2 size={12} />
                                    DELETE ALL GEAR
                                </button>
                                <button
                                    type="button"
                                    className="hoyo-button hoyo-button--muted"
                                    disabled={isLoadingSaveInventory || !validUid}
                                    onClick={() => setInventoryRefreshId((value) => value + 1)}
                                >
                                    {isLoadingSaveInventory ? <LoaderCircle size={12} className="hoyo-spinner" /> : <RefreshCw size={12} />}
                                    REFRESH
                                </button>
                            </div>
                        </div>
                        {!validUid ? (
                            <div className="hoyo-save-inventory__status">Enter a valid player UID to read the game save.</div>
                        ) : saveInventoryError ? (
                            <div className="hoyo-save-inventory__status is-error" role="alert">
                                <AlertTriangle size={14} />
                                <span>{saveInventoryError}</span>
                            </div>
                        ) : isLoadingSaveInventory && !currentSaveInventory ? (
                            <div className="hoyo-save-inventory__status">
                                <LoaderCircle size={14} className="hoyo-spinner" /> Reading account save…
                            </div>
                        ) : (
                            <div className="hoyo-save-inventory__items">
                                {(saveManagerSection === "disks" ? currentSaveInventory?.disks ?? [] : currentSaveInventory?.weapons ?? []).length === 0 ? (
                                    <div className="hoyo-save-inventory__empty">
                                        No {saveManagerSection === "disks" ? "Drive Discs" : "W-Engines"} found in this UID&apos;s save.
                                    </div>
                                ) : (
                                    (saveManagerSection === "disks" ? currentSaveInventory?.disks ?? [] : currentSaveInventory?.weapons ?? [])
                                        .map((item) => {
                                            const disk = saveManagerSection === "disks";
                                            const catalogItem = disk
                                                ? catalog.disks.find((entry) => entry.id === item.setId)
                                                : catalog.weapons.find((entry) => entry.id === item.id);
                                            const equippedNames = (item.equippedToAgentIds ?? [])
                                                .map((agentId) => catalog.characters.find((agent) => agent.id === agentId)?.name)
                                                .filter((name): name is string => Boolean(name));
                                            return (
                                                <article className="hoyo-save-inventory__item" key={`${saveManagerSection}-${item.uid}`}>
                                                    <span className="hoyo-save-inventory__art">
                                                        {catalogItem?.imagePath
                                                            ? <img src={catalogItem.imagePath} alt="" loading="lazy" />
                                                            : <Sparkles size={17} />}
                                                    </span>
                                                    <div className="hoyo-save-inventory__item-main">
                                                        <b>{catalogItem?.name ?? `${disk ? "Drive Disc" : "W-Engine"} ${disk ? item.setId : item.id}`}</b>
                                                        <span>
                                                            {disk ? `SLOT ${item.slot} · ${"★".repeat(item.rank)} · +${item.level}` : `${"★".repeat(item.rank)} · LV ${item.level} · W${item.refinement}`}
                                                            {equippedNames.length > 0 ? ` · EQUIPPED: ${equippedNames.join(", ")}` : " · IN INVENTORY"}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="hoyo-save-inventory__delete"
                                                        disabled={isSubmitting}
                                                        onClick={() => deleteInventoryItem(disk ? "disk" : "weapon", item)}
                                                        aria-label={`Delete ${catalogItem?.name ?? (disk ? "Drive Disc" : "W-Engine")} UID ${item.uid}`}
                                                    >
                                                        <Trash2 size={13} />
                                                        DELETE
                                                    </button>
                                                </article>
                                            );
                                        })
                                )}
                            </div>
                        )}
                </section>
                        )}
                    </section>
                )}
                {confirmationDialog && (
                    <div
                        className="hoyo-confirm-dialog__backdrop"
                        role="presentation"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) setConfirmationDialog(null);
                        }}
                    >
                        <section
                            className={`hoyo-confirm-dialog ${confirmationDialog.danger ? "hoyo-confirm-dialog--danger" : ""}`}
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="hoyo-confirm-dialog-title"
                            aria-describedby="hoyo-confirm-dialog-description"
                        >
                            <header className="hoyo-confirm-dialog__header">
                                <span><AlertTriangle size={18} /></span>
                                <button
                                    type="button"
                                    aria-label="Close confirmation"
                                    onClick={() => setConfirmationDialog(null)}
                                >
                                    <X size={15} />
                                </button>
                            </header>
                            <div className="hoyo-confirm-dialog__content">
                                <span className="hoyo-confirm-dialog__eyebrow">{confirmationDialog.eyebrow}</span>
                                <h2 id="hoyo-confirm-dialog-title">{confirmationDialog.title}</h2>
                                <p id="hoyo-confirm-dialog-description">{confirmationDialog.description}</p>
                                <ul>
                                    {confirmationDialog.details.map((detail) => <li key={detail}>{detail}</li>)}
                                </ul>
                            </div>
                            <footer className="hoyo-confirm-dialog__actions">
                                <button
                                    type="button"
                                    className="hoyo-button hoyo-button--muted"
                                    autoFocus
                                    onClick={() => setConfirmationDialog(null)}
                                >
                                    CANCEL
                                </button>
                                <button
                                    type="button"
                                    className={`hoyo-button ${confirmationDialog.danger ? "hoyo-button--danger" : "hoyo-button--primary"}`}
                                    disabled={isSubmitting || !validUid}
                                    onClick={confirmationDialog.onConfirm}
                                >
                                    {confirmationDialog.danger ? <Trash2 size={13} /> : <ShieldCheck size={13} />}
                                    {confirmationDialog.confirmLabel}
                                </button>
                            </footer>
                        </section>
                    </div>
                )}
                {activePage === "manage" && saveManagerSection === "loadouts" && (
                    <section className="hoyo-saved-disk-sets" aria-label="Saved six-disc sets">
                        <div className="hoyo-saved-disk-sets__heading">
                            <div>
                                <span>SAVED LOADOUTS</span>
                                <h2>Drive Disc Sets</h2>
                                <p>Choose an Agent for each loadout. Empty slots keep their current discs.</p>
                            </div>
                            <b>{savedDiskSets.length} SETS</b>
                        </div>
                        {savedDiskSets.length === 0 ? (
                            <div className="hoyo-saved-disk-sets__empty">No saved sets yet. Name a set and save its first slot to create it here.</div>
                        ) : (
                            <div className="hoyo-saved-disk-sets__list">
                                {savedDiskSets.map((savedSet) => {
                                    const savedSetIds = [...new Set(savedSet.disks.map((disk) => disk.setId ?? savedSet.setId))];
                                    const diskSetItem = catalog.disks.find((item) => item.id === savedSetIds[0]);
                                    const setDescription = savedSetIds.length > 1
                                        ? `${savedSetIds.length} MIXED DRIVE DISC SETS`
                                        : diskSetItem?.name ?? `Drive Disc set ${savedSet.setId}`;
                                    return (
                                        <article className="hoyo-saved-disk-set" key={savedSet.id}>
                                            <header className="hoyo-saved-disk-set__header">
                                                <div className="hoyo-saved-disk-set__title">
                                                    {diskSetItem?.imagePath ? <img src={diskSetItem.imagePath} alt="" /> : <Sparkles size={20} />}
                                                    <div>
                                                        <h3>{savedSet.name}</h3>
                                                        <span>{setDescription} · {savedSet.disks.length}/6 DISCS</span>
                                                    </div>
                                                </div>
                                                <div className="hoyo-saved-disk-set__actions">
                                                    <label className="hoyo-saved-disk-set__target">
                                                        <span>TARGET AGENT</span>
                                                        <select
                                                            value={savedSet.targetAgentId ?? ""}
                                                            onChange={(event) => setSavedDiskSetTarget(
                                                                savedSet,
                                                                event.target.value ? Number(event.target.value) : undefined,
                                                            )}
                                                            aria-label={`Target Agent for ${savedSet.name}`}
                                                            disabled={isSubmitting}
                                                        >
                                                            <option value="">Select an Agent</option>
                                                            {catalog.characters.map((character) => (
                                                                <option key={character.id} value={character.id}>{character.name}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--muted"
                                                        disabled={isSubmitting}
                                                        onClick={() => duplicateSavedDiskSet(savedSet)}
                                                        aria-label={`Duplicate saved set ${savedSet.name}`}
                                                        title="Create an editable copy of this set"
                                                    >
                                                        <Copy size={12} /> DUPLICATE
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--primary"
                                                        disabled={isSubmitting || !savedSet.targetAgentId}
                                                        onClick={() => equipSavedDiskSet(savedSet)}
                                                    >
                                                        {isSubmitting ? "EQUIPPING…" : "EQUIP TO AGENT"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--muted"
                                                        disabled={isSubmitting}
                                                        onClick={() => addSavedDiskSet(savedSet)}
                                                        title="Add these discs to inventory without equipping them"
                                                    >
                                                        {isSubmitting ? "ADDING…" : `ADD TO INVENTORY`}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="hoyo-button hoyo-button--muted"
                                                        disabled={isSubmitting}
                                                        onClick={() => deleteSavedDiskSet(savedSet)}
                                                        aria-label={`Delete saved set ${savedSet.name}`}
                                                    >
                                                        DELETE
                                                    </button>
                                                </div>
                                            </header>
                                            <div className="hoyo-saved-disk-set__disks">
                                                {[1, 2, 3, 4, 5, 6].map((slot) => {
                                                    const disk = savedSet.disks.find((entry) => entry.slot === slot);
                                                    if (!disk) {
                                                        return (
                                                            <div className="hoyo-saved-disk-card is-empty" key={`${savedSet.id}-${slot}`}>
                                                                <div className="hoyo-saved-disk-card__heading">
                                                                    <b>SLOT {slot}</b>
                                                                    <span>EMPTY</span>
                                                                </div>
                                                                <p>Save this slot to add it to the set.</p>
                                                                <button
                                                                    type="button"
                                                                    className="hoyo-saved-disk-card__edit-button"
                                                                    onClick={() => editSavedDiskSlot(savedSet, slot)}
                                                                    aria-label={`Add a disc to slot ${slot} of ${savedSet.name}`}
                                                                >
                                                                    ADD DISC
                                                                </button>
                                                            </div>
                                                        );
                                                    }
                                                    const editKey = savedDiskEditKey(savedSet, disk);
                                                    const editedDisk = editingSavedDisks[editKey];
                                                    const diskCatalogItem = catalog.disks.find(
                                                        (item) => item.id === (editedDisk?.setId ?? disk.setId ?? savedSet.setId),
                                                    );
                                                    return (
                                                        <div className={`hoyo-saved-disk-card ${editedDisk ? "is-editing" : ""}`} key={`${savedSet.id}-${disk.slot}`}>
                                                            <div className="hoyo-saved-disk-card__heading">
                                                                <b>SLOT {disk.slot}</b>
                                                                <span>{"★".repeat(editedDisk?.rank ?? disk.rank)}</span>
                                                            </div>
                                                            <div className="hoyo-saved-disk-card__set">
                                                                {diskCatalogItem?.imagePath
                                                                    ? <img src={diskCatalogItem.imagePath} alt="" title={diskCatalogItem.name} />
                                                                    : <Sparkles size={20} aria-hidden="true" />}
                                                                <span title={diskCatalogItem?.name ?? `Drive Disc ${disk.setId ?? savedSet.setId}`}>
                                                                    {diskCatalogItem?.name ?? `Drive Disc ${disk.setId ?? savedSet.setId}`}
                                                                </span>
                                                            </div>
                                                            {editedDisk ? (
                                                                <div className="hoyo-saved-disk-card__editor">
                                                                    <label>
                                                                        <span>RANK</span>
                                                                        <select
                                                                            value={editedDisk.rank}
                                                                            onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({ ...current, rank: Number(event.target.value) }))}
                                                                        >
                                                                            <option value={2}>B-Rank</option>
                                                                            <option value={3}>A-Rank</option>
                                                                            <option value={4}>S-Rank</option>
                                                                        </select>
                                                                    </label>
                                                                    <label>
                                                                        <span>DRIVE DISC SET</span>
                                                                        <select
                                                                            value={editedDisk.setId ?? savedSet.setId}
                                                                            onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({ ...current, setId: Number(event.target.value) }))}
                                                                        >
                                                                            {catalog.disks.map((item) => (
                                                                                <option key={item.id} value={item.id}>{item.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                    <label>
                                                                        <span>MAIN STAT</span>
                                                                        <select
                                                                            value={editedDisk.mainStat}
                                                                            onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({ ...current, mainStat: Number(event.target.value) }))}
                                                                        >
                                                                            {(MAIN_STATS_BY_SLOT[disk.slot] ?? []).map((statId) => (
                                                                                <option key={statId} value={statId}>{getStatName(statId)}</option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                    {editedDisk.subStatIds.map((statId, index) => {
                                                                        const options = SUBSTAT_IDS.filter((candidate) =>
                                                                            candidate === statId || (
                                                                                candidate !== editedDisk.mainStat &&
                                                                                !editedDisk.subStatIds.some((other, otherIndex) => otherIndex !== index && other === candidate)
                                                                            ),
                                                                        );
                                                                        const maxRolls = Math.max(0, Math.min(
                                                                            14,
                                                                            (editedDisk.allowOverLimitRolls ? 56 : getMaxDiskRolls(editedDisk.rank)) -
                                                                                editedDisk.subStatRolls.reduce((sum, rolls, rollIndex) => sum + (rollIndex === index ? 0 : rolls), 0),
                                                                        ));
                                                                        return (
                                                                            <div className="hoyo-saved-disk-card__substat-edit" key={`${editKey}-${index}`}>
                                                                                <select
                                                                                    value={statId}
                                                                                    aria-label={`Slot ${disk.slot} substat ${index + 1}`}
                                                                                    onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({
                                                                                        ...current,
                                                                                        subStatIds: current.subStatIds.map((value, subIndex) => subIndex === index ? Number(event.target.value) : value),
                                                                                    }))}
                                                                                >
                                                                                    <option value={0}>Choose stat</option>
                                                                                    {options.map((option) => <option key={option} value={option}>{getStatName(option)}</option>)}
                                                                                </select>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max={maxRolls}
                                                                                    value={editedDisk.subStatRolls[index]}
                                                                                    aria-label={`Slot ${disk.slot} substat ${index + 1} rolls`}
                                                                                    onChange={(event) => {
                                                                                        const value = Number(event.target.value);
                                                                                        updateSavedDiskEdit(editKey, (current) => ({
                                                                                            ...current,
                                                                                            subStatRolls: current.subStatRolls.map((rolls, rollIndex) => rollIndex === index
                                                                                                ? Number.isFinite(value) ? Math.max(0, Math.min(maxRolls, Math.floor(value))) : 0
                                                                                                : rolls),
                                                                                        }));
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    <label className="hoyo-saved-disk-card__overlimit">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={editedDisk.allowOverLimitRolls}
                                                                            onChange={(event) => updateSavedDiskEdit(editKey, (current) => ({ ...current, allowOverLimitRolls: event.target.checked }))}
                                                                        />
                                                                        Allow over limit
                                                                    </label>
                                                                    <div className="hoyo-saved-disk-card__edit-status" role="status">
                                                                        <span className={getDiskConfigError(editedDisk) ? "is-invalid" : ""}>
                                                                            {getDiskConfigError(editedDisk) ?? "Changes auto-saved"}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            disabled={Boolean(getDiskConfigError(editedDisk))}
                                                                            onClick={() => setEditingSavedDisks((current) => Object.fromEntries(
                                                                                Object.entries(current).filter(([key]) => key !== editKey),
                                                                            ))}
                                                                        >
                                                                            DONE
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <strong>{getStatName(disk.mainStat)}</strong>
                                                                    <ul>
                                                                        {disk.subStatIds.map((statId, index) => (
                                                                            <li key={`${disk.slot}-${statId}`}>
                                                                                <span>{getStatName(statId)}</span>
                                                                                <b>+{disk.subStatRolls[index]}</b>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                    <button
                                                                        type="button"
                                                                        className="hoyo-saved-disk-card__edit-button"
                                                                        onClick={() => setEditingSavedDisks((current) => ({ ...current, [editKey]: { ...disk, subStatIds: [...disk.subStatIds], subStatRolls: [...disk.subStatRolls] } }))}
                                                                    >
                                                                        EDIT DISC
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
                </>
            )}
        </main>
    );
}
