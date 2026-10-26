// Layout adapted from shadcn/ui preview-02 (MIT); see build/verification/luma-showcase/source.
import { useState, type MouseEvent } from "react"
import { usePreviewMode } from "./preview-mode"
import { Button } from "./components/button"
import { IconPlaceholder } from "./showcase-icons"
import "./showcase.css"
import { AccountAccess } from "./showcase/cards/account-access"
import { CardOverview } from "./showcase/cards/card-overview"
import { ClaimableBalance } from "./showcase/cards/claimable-balance"
import { ContributionHistory } from "./showcase/cards/contribution-history"
import { CoverArt } from "./showcase/cards/cover-art"
import { DividendIncome } from "./showcase/cards/dividend-income"
import { EmptyConnectBank } from "./showcase/cards/empty-connect-bank"
import { EmptyDistributeTrack } from "./showcase/cards/empty-distribute-track"
import { EmptyExploreCatalog } from "./showcase/cards/empty-explore-catalog"
import { Faq } from "./showcase/cards/faq"
import { FrontDoor } from "./showcase/cards/front-door"
import { IndexInvesting } from "./showcase/cards/index-investing"
import { KitchenIsland } from "./showcase/cards/kitchen-island"
import { LoadingCard } from "./showcase/cards/loading-card"
import { NewMilestone } from "./showcase/cards/new-milestone"
import { NotificationSettings } from "./showcase/cards/notification-settings"
import { Payments } from "./showcase/cards/payments"
import { PayoutThreshold } from "./showcase/cards/payout-threshold"
import { PowerUsage } from "./showcase/cards/power-usage"
import { Preferences } from "./showcase/cards/preferences"
import { QrConnect } from "./showcase/cards/qr-connect"
import { ReceivingMethod } from "./showcase/cards/receiving-method"
import { RecentTransactions } from "./showcase/cards/recent-transactions"
import { ReleaseCatalog } from "./showcase/cards/release-catalog"
import { RollerShades } from "./showcase/cards/roller-shades"
import { SavingsProgress } from "./showcase/cards/savings-progress"
import { SavingsTargets } from "./showcase/cards/savings-targets"
import { SidebarNav } from "./showcase/cards/sidebar-nav"
import { SocialLinks } from "./showcase/cards/social-links"
import { StockPerformance } from "./showcase/cards/stock-performance"
import { SyncingState } from "./showcase/cards/syncing-state"
import { TransferFunds } from "./showcase/cards/transfer-funds"
import { UpcomingPayments } from "./showcase/cards/upcoming-payments"

export function LumaShowcase() {
  const mode = usePreviewMode()
  const [notice, setNotice] = useState("")

  const reportLocalAction = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    const action = target.closest<HTMLElement>('button[data-slot="button"], a[href="#"], button[data-slot="sidebar-menu-button"], [role="menuitem"]')
    if (!action || action.hasAttribute("aria-haspopup") || action.hasAttribute("disabled")) return
    if (action.tagName === "A") event.preventDefault()
    const name = action.getAttribute("aria-label") || action.textContent?.trim()
    if (name) setNotice(`Local preview · ${name}`)
  }

  return (
    <main className="ui-theme luma-showcase sb-unstyled" data-ui-theme={mode} onClick={reportLocalAction}>
      <h1 className="sr-only">Luma component showcase</h1>
      <div className="luma-showcase-scroll" tabIndex={0} role="region" aria-label="Luma component preview; scroll horizontally to view all seven columns">

      <div className="luma-showcase-center">
        <div
          className="luma-showcase-canvas"
          data-slot="capture-target"
        >
          <div className="luma-showcase-column">
            <ContributionHistory />
            <EmptyDistributeTrack />
            <QrConnect />
            <DividendIncome />
            <IndexInvesting />
            <SyncingState />
          </div>
          <div className="luma-showcase-column">
            <PayoutThreshold />
            <ClaimableBalance />
            <Preferences />
            <SavingsProgress />
            <KitchenIsland />
          </div>
          <div className="luma-showcase-column luma-showcase-column-wide">
            <SavingsTargets />
            <RecentTransactions />
            <div className="luma-showcase-nested-grid">
              <div className="luma-showcase-nested-column">
                <SidebarNav />
                <Faq />
              </div>
              <div className="luma-showcase-nested-column">
                <Payments />
                <FrontDoor />
              </div>
            </div>
            <ReleaseCatalog />
          </div>
          <div className="luma-showcase-column">
            <AccountAccess />
            <CardOverview />
            <TransferFunds />
            <CoverArt />
            <LoadingCard />
          </div>
          <div className="luma-showcase-column">
            <ReceivingMethod />
            <PowerUsage />
            <EmptyConnectBank />
            <UpcomingPayments />
            <RollerShades />
          </div>
          <div className="luma-showcase-column">
            <StockPerformance />
            <EmptyExploreCatalog />
            <NewMilestone />
            <SocialLinks />
            <NotificationSettings />
          </div>
        </div>
      </div>
      </div>
      {notice && <output className="luma-showcase-notice" aria-live="polite">{notice}<Button variant="ghost" size="icon-sm" aria-label="Dismiss preview feedback" onClick={(event) => { event.stopPropagation(); setNotice("") }}><IconPlaceholder hugeicons="Cancel01Icon" /></Button></output>}
    </main>
  )
}
