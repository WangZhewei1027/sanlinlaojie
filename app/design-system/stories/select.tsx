import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StorySection } from "../components/StorySection";

export function SelectStory() {
  return (
    <StorySection title="Basic">
      <Select>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="选择资源类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>媒体</SelectLabel>
            <SelectItem value="image">图片</SelectItem>
            <SelectItem value="video">视频</SelectItem>
            <SelectItem value="audio">音频</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>其他</SelectLabel>
            <SelectItem value="document">文档</SelectItem>
            <SelectItem value="link">链接</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select disabled>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Disabled" />
        </SelectTrigger>
        <SelectContent />
      </Select>
    </StorySection>
  );
}
