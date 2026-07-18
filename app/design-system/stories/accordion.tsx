import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StorySection } from "../components/StorySection";

export function AccordionStory() {
  return (
    <StorySection title="Basic">
      <Accordion type="single" collapsible className="w-full max-w-md">
        <AccordionItem value="item-1">
          <AccordionTrigger>什么是三林老街 AR 项目？</AccordionTrigger>
          <AccordionContent>
            一个把 AR 内容放置到三林老街真实地理位置的文化项目。
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>如何上传资源？</AccordionTrigger>
          <AccordionContent>
            在管理工作台点击地图选择位置，然后上传图片、音频或视频。
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>支持哪些文件类型？</AccordionTrigger>
          <AccordionContent>图片、视频、音频、文档、链接和文本。</AccordionContent>
        </AccordionItem>
      </Accordion>
    </StorySection>
  );
}
