import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { getMyWallet, getWalletTransactions } from '../../services/deliveryApi';
import { MoneyIcon, WalletIcon, AdjustmentsIcon, DocumentTextIcon } from '../../components/SvgIcons';

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
        {isCODCash ? <MoneyIcon size={20} color="#2563EB" /> : isCommission ? <WalletIcon size={20} color="#16A34A" /> : <AdjustmentsIcon size={20} color="#4B5563" />}
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
        <Text style={[styles.txAmount, { color: tx.type === 'CREDIT' ? '#22C55E' : '#EF4444' }]}>
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#F5A623" size="large" /></View>;

  const earnings = wallet?.earningsWallet || {};
  const cashWallet = wallet?.cashInHandWallet || {};
  const summary = wallet?.transactionSummary || {};
  const meta = wallet?.meta || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.pageTitle}>Wallet</Text>

      {/* Earnings Card */}
      <View style={[styles.walletCard, styles.earningsCard, { backgroundColor: '#10B981' }]}>
        <Text style={styles.walletCardLabel}>Distance Earnings</Text>
        <Text style={styles.walletCardAmount}>{formatCurrency(earnings.balance)}</Text>


        <View style={styles.walletCardRow}>
          <View style={styles.walletCardStat}>
            <Text style={styles.walletStatLabel}>Total Distance</Text>
            <Text style={styles.walletStatValue}>{meta.totalDistanceKm ?? 0} km</Text>
          </View>
          <View style={styles.walletCardDivider} />
          <View style={styles.walletCardStat}>
            <Text style={styles.walletStatLabel}>Per Km Rate</Text>
            <Text style={styles.walletStatValue}>₹{meta.perKmRate ?? 0}</Text>
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
          <DocumentTextIcon size={40} color="#9CA3AF" />
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 28, fontWeight: '900', color: '#1C2434', marginHorizontal: 20, marginTop: 20, marginBottom: 16 },

  walletCard: {
    marginHorizontal: 20, borderRadius: 16, padding: 24, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    shadowOffset: { width: 0, height: 4 },
  },
  earningsCard: { backgroundColor: '#F5A623' },
  cashCard: { backgroundColor: '#1C2434' },
  walletCardLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  walletCardAmount: { color: '#fff', fontSize: 34, fontWeight: '900', marginBottom: 20 },
  walletCardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  walletCardDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  walletCardStat: { flex: 1, alignItems: 'center' },
  walletStatLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  walletStatValue: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 4 },

  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1C2434', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },

  txList: {
    backgroundColor: '#FFFFFF', marginHorizontal: 20, borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    shadowOffset: { width: 0, height: 2 }, overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  txIconBadge: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txBadgeCash: { backgroundColor: '#DBEAFE' },
  txBadgeCommission: { backgroundColor: '#DCFCE7' },
  txIcon: { fontSize: 18 },
  txDesc: { fontSize: 14, fontWeight: '700', color: '#1C2434' },
  txMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800' },
  txSubAmount: { fontSize: 11, color: '#9CA3AF' },

  emptyBox: {
    alignItems: 'center', paddingVertical: 48, marginHorizontal: 20,
    backgroundColor: '#F9FAFB', borderRadius: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#9CA3AF', marginTop: 8, fontSize: 15, fontWeight: '500' },
});
