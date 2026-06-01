import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { theme } from '../../theme/tokens';
import { getMyWallet, getWalletTransactions } from '../../services/deliveryApi';

type Props = { idToken: string };

function formatCurrency(amount: number, currency = 'INR') {
  return `₹${Number(amount || 0).toFixed(2)}`;
}

function TxRow({ tx }: { tx: any }) {
  const isCODCash = tx.source === 'COD_CASH_COLLECTION';
  const isCommission = tx.source === 'DELIVERY_COMMISSION';
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconBadge, isCODCash ? styles.txBadgeCash : styles.txBadgeCommission]}>
        <Text style={styles.txIcon}>{isCODCash ? '💵' : isCommission ? '💰' : '🔧'}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.txDesc} numberOfLines={1}>{tx.description || tx.source}</Text>
        <Text style={styles.txMeta}>
          {isCODCash ? 'Cash Collected' : isCommission ? `${tx.paymentMode === 'CASH' ? 'COD' : 'Online'} Commission` : 'Adjustment'}
          {' · '}
          {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.txAmount, { color: tx.type === 'CREDIT' ? theme.colors.success : theme.colors.danger }]}>
          {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(isCODCash ? tx.cashAmount : tx.amount)}
        </Text>
        {isCODCash && (
          <Text style={styles.txSubAmount}>Cash collected</Text>
        )}
      </View>
    </View>
  );
}

export function DeliveryWalletTab({ idToken }: Props) {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [walletRes, txRes] = await Promise.all([
          getMyWallet(idToken),
          getWalletTransactions(idToken),
        ]);
        setWallet(walletRes);
        setTransactions(txRes.transactions || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [idToken]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.brandPrimary} size="large" /></View>;

  const earnings = wallet?.earningsWallet || {};
  const cashWallet = wallet?.cashInHandWallet || {};
  const summary = wallet?.transactionSummary || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.pageTitle}>Wallet</Text>

      {/* Earnings Card */}
      <View style={[styles.walletCard, styles.earningsCard]}>
        <Text style={styles.walletCardLabel}>Earnings Balance</Text>
        <Text style={styles.walletCardAmount}>{formatCurrency(earnings.balance)}</Text>
        <View style={styles.walletCardRow}>
          <View style={styles.walletCardStat}>
            <Text style={styles.walletStatLabel}>Online Orders</Text>
            <Text style={styles.walletStatValue}>{formatCurrency(earnings.totalOnlineEarnings)}</Text>
          </View>
          <View style={styles.walletCardDivider} />
          <View style={styles.walletCardStat}>
            <Text style={styles.walletStatLabel}>COD Commission</Text>
            <Text style={styles.walletStatValue}>{formatCurrency(earnings.totalCODCommissionEarnings)}</Text>
          </View>
          <View style={styles.walletCardDivider} />
          <View style={styles.walletCardStat}>
            <Text style={styles.walletStatLabel}>Total Earned</Text>
            <Text style={styles.walletStatValue}>{formatCurrency(earnings.totalCredited)}</Text>
          </View>
        </View>
      </View>

      {/* Cash in Hand Card */}
      <View style={[styles.walletCard, styles.cashCard]}>
        <Text style={styles.walletCardLabel}>Cash in Hand</Text>
        <Text style={styles.walletCardAmount}>{formatCurrency(cashWallet.cashInHand)}</Text>
        <View style={styles.walletCardRow}>
          <View style={styles.walletCardStat}>
            <Text style={styles.walletStatLabel}>Total Collected</Text>
            <Text style={styles.walletStatValue}>{formatCurrency(cashWallet.totalCashCollected)}</Text>
          </View>
          <View style={styles.walletCardDivider} />
          <View style={styles.walletCardStat}>
            <Text style={styles.walletStatLabel}>Cash Orders</Text>
            <Text style={styles.walletStatValue}>{summary.cashCollectionCount ?? 0}</Text>
          </View>
          <View style={styles.walletCardDivider} />
          <View style={styles.walletCardStat}>
            <Text style={styles.walletStatLabel}>Online Orders</Text>
            <Text style={styles.walletStatValue}>{summary.onlineCommissionCount ?? 0}</Text>
          </View>
        </View>
      </View>

      {/* Transaction Ledger */}
      <Text style={styles.sectionTitle}>Transaction History</Text>
      {transactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        <View style={styles.txList}>
          {transactions.map((tx: any) => <TxRow key={tx._id} tx={tx} />)}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.brandCanvas },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: theme.typography.h1, fontWeight: '800', color: theme.colors.ink900, margin: theme.spacing.lg, marginBottom: theme.spacing.sm },
  walletCard: { marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, padding: theme.spacing.lg, marginBottom: 14, ...theme.shadow.card },
  earningsCard: { backgroundColor: theme.colors.brandPrimary },
  cashCard: { backgroundColor: '#1e3a5f' },
  walletCardLabel: { color: 'rgba(255,255,255,0.75)', fontSize: theme.typography.small, fontWeight: '600', marginBottom: 4 },
  walletCardAmount: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 16 },
  walletCardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  walletCardDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  walletCardStat: { flex: 1, alignItems: 'center' },
  walletStatLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  walletStatValue: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 4 },
  sectionTitle: { fontSize: theme.typography.h2, fontWeight: '700', color: theme.colors.ink900, marginHorizontal: theme.spacing.lg, marginBottom: 10 },
  txList: { backgroundColor: '#FAE08B', marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, ...theme.shadow.card, overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  txIconBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txBadgeCash: { backgroundColor: '#dbeafe' },
  txBadgeCommission: { backgroundColor: '#dcfce7' },
  txIcon: { fontSize: 18 },
  txDesc: { fontSize: theme.typography.small, fontWeight: '600', color: theme.colors.ink900 },
  txMeta: { fontSize: theme.typography.micro, color: theme.colors.ink500, marginTop: 2 },
  txAmount: { fontSize: theme.typography.body, fontWeight: '800' },
  txSubAmount: { fontSize: theme.typography.micro, color: theme.colors.ink500 },
  emptyBox: { alignItems: 'center', padding: 40, marginHorizontal: theme.spacing.lg, backgroundColor: '#FAE08B', borderRadius: theme.radius.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: theme.colors.ink500, marginTop: 8 },
});

