import {
  ScreenStatePanel,
  SectionBlock,
  SemanticBadge,
  Text,
} from "@/design-system";

import type {
  DomainProduct,
  DomainProductConsumer,
  DomainProductTrustCertification,
} from "./api";
import styles from "./domain-product-discovery.module.css";
import {
  type SourceAvailability,
  formatIdentifier,
  formatStateLabel,
  getEvidenceValue,
  getLineageValue,
  getProductTrustLabel,
  getTrustTone,
} from "./presentation";

export function ProductCatalogueSection({
  products,
  trustByProductId,
  trustAvailability,
}: {
  products: DomainProduct[];
  trustByProductId: Map<string, DomainProductTrustCertification>;
  trustAvailability: SourceAvailability;
}) {
  if (products.length === 0) {
    return (
      <ScreenStatePanel
        kind="empty"
        title="No data products are available"
        body="The governed catalogue returned no products for the Workbench."
        hint="Product ownership and approved-use details will appear when catalogue entries are published."
      />
    );
  }

  return (
    <SectionBlock
      title="Available data products"
      subtitle="Review accountable ownership, approved use and source-confirmed assurance before relying on a product."
    >
      <div className={styles.productGrid}>
        {products.map((product) => (
          <ProductCard
            key={product.productId}
            product={product}
            trust={trustByProductId.get(product.productId)}
            trustAvailability={trustAvailability}
          />
        ))}
      </div>
    </SectionBlock>
  );
}

export function ApprovedUseSection({
  consumers,
}: {
  consumers: DomainProductConsumer[];
}) {
  return (
    <SectionBlock
      title="Approved use"
      subtitle="Declared consumers and the products they are permitted to use."
    >
      {consumers.length === 0 ? (
        <ScreenStatePanel
          kind="empty"
          title="No approved consumers are declared"
          body="The catalogue does not currently declare any consuming systems."
        />
      ) : (
        <div className={styles.consumerList}>
          {consumers.map((consumer) => (
            <div key={consumer.consumerRepository} className={styles.consumerRow}>
              <div className={styles.consumerIdentity}>
                <Text variant="dataLabel">{formatIdentifier(consumer.consumerRepository)}</Text>
                <Text variant="secondary">{consumer.dependencyCount} declared dependencies</Text>
              </div>
              <div className={styles.badgeRow}>
                {consumer.dependencies.map((dependency) => (
                  <SemanticBadge key={dependency.dependencyId}>
                    {formatIdentifier(dependency.productName)} {dependency.requiredProductVersion}
                  </SemanticBadge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionBlock>
  );
}

function ProductCard({
  product,
  trust,
  trustAvailability,
}: {
  product: DomainProduct;
  trust: DomainProductTrustCertification | undefined;
  trustAvailability: SourceAvailability;
}) {
  const trustState = getProductTrustLabel(trust, trustAvailability);
  const trustTone =
    trustAvailability === "retained"
      ? "warn"
      : trust
        ? getTrustTone(trust.certificationState)
        : "default";

  return (
    <article className={styles.productCard}>
      <div className={styles.productHeader}>
        <div>
          <Text variant="secondary">{formatIdentifier(product.authoritativeDomain)}</Text>
          <h2>{formatIdentifier(product.productName)}</h2>
          <Text variant="secondary">Version {product.productVersion}</Text>
        </div>
        <SemanticBadge tone={trustTone}>{trustState}</SemanticBadge>
      </div>
      <dl className={styles.productFacts}>
        <div>
          <dt>Lifecycle</dt>
          <dd>{formatStateLabel(product.lifecycleStatus)}</dd>
        </div>
        <div>
          <dt>Accountable source</dt>
          <dd>{formatIdentifier(product.ownerRepository)}</dd>
        </div>
        <div>
          <dt>Approved consumers</dt>
          <dd>{product.approvedConsumers.map(formatIdentifier).join(", ") || "None declared"}</dd>
        </div>
        <div>
          <dt>Freshness</dt>
          <dd>{getEvidenceValue(trust?.freshnessState, trustAvailability)}</dd>
        </div>
        <div>
          <dt>Completeness</dt>
          <dd>{getEvidenceValue(trust?.completenessStatus, trustAvailability)}</dd>
        </div>
        <div>
          <dt>Lineage</dt>
          <dd>{getLineageValue(trust?.lineageMaterialized, trustAvailability)}</dd>
        </div>
      </dl>
      <Text variant="secondary" className={styles.productReference}>
        {product.productId}
      </Text>
    </article>
  );
}
