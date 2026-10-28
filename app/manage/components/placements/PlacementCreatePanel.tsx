"use client";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { Plus } from "lucide-react";
import { useState } from "react";
import { PlaceExistingForm } from "./PlaceExistingForm";
import { usePlacementMap } from "./PlacementMapContext";
import { UploadAndPlaceForm } from "./UploadAndPlaceForm";

type CreateMode = "existing" | "upload";

/**
 * Upload and place panel. Shown only for a real project
 * whose capabilities allow editing. Every new placement needs an explicit
 * map location. Activities are managed through their own placement tab.
 */
export function PlacementCreatePanel() {
  const { tx } = usePlacementMap();
  const [mode, setMode] = useState<CreateMode>("existing");
  const modes: CreateMode[] = ["existing", "upload"];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-1.5 border-b bg-muted/20 px-4 py-3">
        <Plus className="size-4 text-muted-foreground" aria-hidden />
        <Text as="h3" variant="bodySm" fontWeight="semibold">{tx("contentModel.integration.map.create.title")}</Text>
      </div>
      <Tabs value={mode} onValueChange={(value) => setMode(value as CreateMode)} className="p-4">
        <TabsList className="w-full">
          {modes.map((key) => (
            <TabsTrigger key={key} value={key} className="flex-1 text-xs">{tx(`contentModel.integration.map.create.mode.${key}`)}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="existing" className="pt-3">
          <PlaceExistingForm />
        </TabsContent>
        <TabsContent value="upload" className="pt-3">
          <UploadAndPlaceForm />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
