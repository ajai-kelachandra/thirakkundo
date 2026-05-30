import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://thirakkundo.in',
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1,
    },
  ];
}
