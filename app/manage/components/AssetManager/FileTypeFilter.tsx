"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Layers, X } from "lucide-react";

interface FileTypeFilterProps {
  fileTypes: string[];
  selectedFileTypes: string[];
  onFileTypesChange: (fileTypes: string[]) => void;
}

export function FileTypeFilter({
  fileTypes,
  selectedFileTypes,
  onFileTypesChange,
}: FileTypeFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleToggle = (type: string) => {
    if (selectedFileTypes.includes(type)) {
      onFileTypesChange(selectedFileTypes.filter((t) => t !== type));
    } else {
      onFileTypesChange([...selectedFileTypes, type]);
    }
  };

  const handleClearAll = () => {
    onFileTypesChange([]);
  };

  const hasFilters = selectedFileTypes.length > 0;

  const getLabel = (type: string) => {
    const key = `assetManager.fileTypeFilter.types.${type}`;
    const translated = t(key);
    // 如果没有对应翻译，直接返回原值
    return translated === key ? type : translated;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={hasFilters ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1"
        >
          <Layers className="h-3.5 w-3.5" />
          {t("assetManager.fileTypeFilter.title")}
          {hasFilters && (
            <Badge variant="secondary" className="ml-1 px-1 py-0 h-4 min-w-4">
              {selectedFileTypes.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <div className="p-2">
          <div className="flex items-center justify-between mb-2 pb-2 border-b">
            <span className="text-sm font-medium">
              {t("assetManager.fileTypeFilter.selectTypes")}
            </span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-6 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                {t("assetManager.fileTypeFilter.clear")}
              </Button>
            )}
          </div>

          {fileTypes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              {t("assetManager.fileTypeFilter.noTypes")}
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {fileTypes.map((type) => (
                <div
                  key={type}
                  className="flex items-center space-x-2 py-1 px-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => handleToggle(type)}
                >
                  <Checkbox
                    id={`filetype-${type}`}
                    checked={selectedFileTypes.includes(type)}
                    onCheckedChange={() => handleToggle(type)}
                  />
                  <label
                    htmlFor={`filetype-${type}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {getLabel(type)}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
