import React, { useState } from 'react';
import styles from './dashboard.module.css';

interface DataCategorySectionProps {
    title: string;
    icon: string;
    iconColor: string;
    items: any[];
    renderCard: (item: any) => React.ReactNode;
    renderDetail: (item: any) => React.ReactNode;
    getItemStyle?: (item: any) => React.CSSProperties;
    groupBy?: (item: any) => string;
    searchKeys?: string[];
    emptyMessage?: string;
    onItemClick?: (item: any) => void;
}

export const DataCategorySection: React.FC<DataCategorySectionProps> = ({
    title,
    icon,
    iconColor,
    items,
    renderCard,
    renderDetail,
    getItemStyle,
    groupBy,
    searchKeys = ['name', 'title'],
    emptyMessage = "No items recorded yet.",
    onItemClick
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [isSectionExpanded, setIsSectionExpanded] = useState(false);

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    // Filter items
    const filteredItems = items.filter(item => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return searchKeys.some(key => {
            const val = item[key];
            return val && String(val).toLowerCase().includes(query);
        });
    });

    const renderItemCard = (item: any, idx: number) => {
        // Use item.id if available, otherwise use index as ID fallback (less ideal for animations but works)
        const itemId = item.id || `item-${idx}`;
        const isExpanded = expandedIds.has(itemId);
        const itemStyle = getItemStyle ? getItemStyle(item) : {};

        return (
            <div
                key={itemId}
                className={`${styles.expandableCard} ${isExpanded ? styles.expanded : ''}`}
                onClick={() => {
                    if (onItemClick) {
                        onItemClick(item);
                    } else {
                        toggleExpand(itemId);
                    }
                }}
                style={{ ...itemStyle, cursor: 'pointer' }}
            >
                <div className={styles.cardHeader}>
                    <div style={{ flex: 1, padding: '1rem' }}>{renderCard(item)}</div>
                    <button
                        className={styles.expandToggle}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onItemClick) {
                                onItemClick(item);
                            } else {
                                toggleExpand(itemId);
                            }
                        }}
                    >
                        <span className="material-symbols-outlined" style={{
                            transform: (!onItemClick && isExpanded) ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                        }}>
                            {onItemClick ? 'arrow_forward' : 'expand_more'}
                        </span>
                    </button>
                </div>
                {!onItemClick && (
                    <div
                        className={styles.cardDetail}
                        style={{
                            maxHeight: isExpanded ? '1000px' : '0',
                            opacity: isExpanded ? 1 : 0,
                            marginTop: isExpanded ? '1rem' : '0',
                            paddingTop: isExpanded ? '1rem' : '0',
                            borderTop: isExpanded ? '1px solid #edf2f7' : 'none'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {renderDetail(item)}
                    </div>
                )}
            </div>
        );
    };

    let content;
    if (filteredItems.length === 0) {
        content = (
            <div className={styles.emptyState}>
                <p style={{ color: '#718096', fontStyle: 'italic', margin: 0 }}>
                    {items.length === 0 ? emptyMessage : `No matching ${title.toLowerCase()} found.`}
                </p>
            </div>
        );
    } else if (groupBy) {
        const groups: { [key: string]: any[] } = {};
        filteredItems.forEach(item => {
            const groupName = groupBy(item) || 'Other';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(item);
        });

        content = (
            <div className={styles.sectionGroups}>
                {Object.entries(groups).map(([groupName, groupItems]) => (
                    <div key={groupName} className={styles.sectionGroup}>
                        <h4 className={styles.groupTitle}>{groupName}</h4>
                        <div className={styles.sectionGrid}>
                            {groupItems.map((item, idx) => renderItemCard(item, idx))}
                        </div>
                    </div>
                ))}
            </div>
        );
    } else {
        content = (
            <div className={styles.sectionGrid}>
                {filteredItems.map((item, idx) => renderItemCard(item, idx))}
            </div>
        );
    }

    return (
        <div className={styles.categorySection}>
            <div
                className={styles.sectionHeaderRow}
                onClick={() => setIsSectionExpanded(!isSectionExpanded)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
            >
                <h3 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                        className="material-symbols-outlined"
                        style={{
                            transform: isSectionExpanded ? 'rotate(180deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.3s ease',
                            color: '#718096'
                        }}
                    >
                        expand_more
                    </span>
                    <span className="material-symbols-outlined" style={{ color: iconColor }}>{icon}</span>
                    {title}
                </h3>
                {/* Only show search if expanded */}
                {isSectionExpanded && items.length > 0 && (
                    <div className={styles.inlineSearch} onClick={(e) => e.stopPropagation()}>
                        <span className="material-symbols-outlined">search</span>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {isSectionExpanded && (
                <div style={{ marginTop: '1rem', animation: 'fadeIn 0.3s ease' }}>
                    {content}
                </div>
            )}
        </div>
    );
};
