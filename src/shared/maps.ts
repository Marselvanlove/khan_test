export interface MapLinkOption {
  label: string;
  url: string;
}

function normalizeLocationLabel(address: string | null | undefined, city?: string | null) {
  return [city?.trim(), address?.trim()].filter(Boolean).join(", ").trim();
}

export function buildMapLinks(
  address: string | null | undefined,
  city?: string | null,
): MapLinkOption[] {
  const query = normalizeLocationLabel(address, city);

  if (!query) {
    return [];
  }

  const encoded = encodeURIComponent(query);

  return [
    {
      label: "Яндекс Карты",
      url: `https://yandex.ru/maps/?text=${encoded}`,
    },
    {
      label: "2ГИС",
      url: `https://2gis.kz/search/${encoded}`,
    },
    {
      label: "Google Maps",
      url: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    },
  ];
}
