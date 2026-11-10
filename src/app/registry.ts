import {
  Braces,
  Binary,
  Clock,
  Link,
  Database,
  KeyRound,
  Regex,
  Columns2,
  Fingerprint,
  Shuffle,
  CalendarClock,
  Calculator,
} from "lucide-react";
import type { Key } from "../locales";
export const ids = [
  "json",
  "sql",
  "base64",
  "url",
  "jwt",
  "regex",
  "diff",
  "timestamp",
  "hash",
  "uuid",
  "cron",
  "radix",
] as const;
export type Id = (typeof ids)[number];
export type AdvancedId = Exclude<Id, "json" | "base64" | "url" | "timestamp">;
export function isAdvanced(id: Id): id is AdvancedId {
  return !["json", "base64", "url", "timestamp"].includes(id);
}
export const icons = {
  json: Braces,
  sql: Database,
  base64: Binary,
  timestamp: Clock,
  url: Link,
  jwt: KeyRound,
  regex: Regex,
  diff: Columns2,
  hash: Fingerprint,
  uuid: Shuffle,
  cron: CalendarClock,
  radix: Calculator,
};
export const categories: { key: Key; ids: Id[] }[] = [
  { key: "format", ids: ["json", "sql"] },
  { key: "encoding", ids: ["base64", "url", "jwt"] },
  { key: "textCategory", ids: ["regex", "diff"] },
  { key: "timeCategory", ids: ["timestamp", "cron"] },
  { key: "computeCategory", ids: ["hash", "uuid", "radix"] },
];
export const keywords: Record<Id, string> = {
  json: "json 格式化 压缩 校验 树",
  sql: "sql mysql postgres sqlite 格式化 数据库",
  base64: "base64 utf8 编码 解码",
  timestamp: "timestamp unix date 时间 日期 时区",
  url: "url uri query 参数 编码 解码",
  jwt: "jwt token header payload 令牌",
  regex: "regex regexp 正则 匹配 替换",
  diff: "diff compare 文本 对比 差异",
  hash: "hash sha 摘要 文件",
  uuid: "uuid guid 随机 唯一",
  cron: "cron 定时 调度 执行",
  radix: "radix base bigint 进制 二进制 十六进制",
};
export const examples: Record<Id, string> = {
  json: '{"project":"DevKit","developer":"栈外手记","features":["JSON","SQL","Hash"],"localFirst":true,"largeId":9007199254740993}',
  base64: "Hello, 开发者 👋",
  url: "https://example.com/search?q=开发者&q=DevKit&empty=&token=a%3Db",
  timestamp: "1735689600",
  sql: "select u.id,u.name,count(o.id) as orders from users u left join orders o on u.id=o.user_id where u.name='中文 user' group by u.id,u.name;",
  jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJleGFtcGxlIiwiaWF0IjoxNzM1Njg5NjAwLCJleHAiOjE3MzU3NzYwMDB9.ZGVtby1zaWduYXR1cmU",
  regex: "Order #1024 · 订单 #2048",
  diff: "Hello DevKit\nLocal tools\nVersion 1\n",
  hash: "abc",
  uuid: "550e8400-e29b-41d4-a716-446655440000\n550E8400-E29B-41D4-A716-446655440000",
  cron: "0 9 * * 1-5",
  radix: "9007199254740993",
};
export function validIds(value: unknown): Id[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is Id => ids.includes(id)))].slice(
        0,
        12,
      )
    : [];
}
