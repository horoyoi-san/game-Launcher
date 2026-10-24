import { FSService } from "@bindings/sunbringer-launcher/internal/fs-service";
import path from "path-browserify";

export const zenlessDataDirectories = ["ZenlessZoneZeroBeta_Data", "ZenlessZoneZero_Data"];

export async function findZenlessDataDirectory(gameDir: string): Promise<string> {
    for (const directory of zenlessDataDirectories) {
        if (await FSService.DirExists(path.join(gameDir, directory))) return directory;
    }
    return "";
}
