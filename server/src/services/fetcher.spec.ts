import { parseStringPromise } from 'xml2js';

const sampleRss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Sample</title>
    <item>
      <title>Job 1</title>
      <link>https://example.com/job1</link>
      <guid>g1</guid>
      <description>First job</description>
      <pubDate>Thu, 29 Jan 2026 00:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Job 2</title>
      <link>https://example.com/job2</link>
      <guid>g2</guid>
      <description>Second job</description>
      <pubDate>Thu, 29 Jan 2026 01:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe('XML parsing', () => {
  it('parses RSS and finds two items', async () => {
    const parsed = await parseStringPromise(sampleRss, { explicitArray: false, mergeAttrs: true, trim: true });
    expect(parsed.rss.channel.item).toBeDefined();
    const items = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item];
    expect(items.length).toBe(2);
    expect(items[0].title).toBe('Job 1');
    expect(items[1].guid).toBe('g2');
  });
});
